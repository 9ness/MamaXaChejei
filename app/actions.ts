'use server';

import { redis } from '@/lib/redis';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { z } from 'zod';

// Schema for Member validation
const MemberSchema = z.object({
    id: z.string(),
    nombre: z.string().min(2, "El nombre es obligatorio"),
    apellido1: z.string().min(2, "El apellido 1 es obligatorio"),
    apellido2: z.string().optional(),
    talla: z.string(),
    pagado: z.boolean().default(false),
    fechaPagado: z.string().optional(),
    recogido: z.boolean().default(false),
    fechaRecogido: z.string().optional(),
    order: z.number().optional(),
});

export type Member = z.infer<typeof MemberSchema>;

const NAMESPACE = 'fiesta';
const MEMBERS_KEY = `${NAMESPACE}:miembros_zset`; // Sorted Set for ordered IDs

export async function getMembers(): Promise<Member[]> {
    try {
        const ids = await redis.zrange(MEMBERS_KEY, 0, -1);
        if (!ids || ids.length === 0) return [];

        const pipeline = redis.pipeline();
        ids.forEach(id => {
            pipeline.hgetall(`${NAMESPACE}:miembro:${id}`);
        });

        const results = await pipeline.exec<Member[]>();
        const members = results.filter(m => m !== null && Object.keys(m).length > 0) as Member[];

        const formattedMembers = members.map(m => ({
            ...m,
            pagado: String(m.pagado) === 'true',
            recogido: String(m.recogido) === 'true',
        }));

        return formattedMembers.map((m, index) => ({
            ...m,
            // Prefer stored order (from bulk load), fallback to index+1
            order: m.order ?? (index + 1)
        }));
    } catch {
        return [];
    }
}

export async function addMember(formData: FormData) {
    const nombre = formData.get('nombre') as string;
    const apellido1 = formData.get('apellido1') as string;
    const apellido2 = formData.get('apellido2') as string;
    const talla = formData.get('talla') as string;

    const id = crypto.randomUUID();

    const newMember: Member = {
        id,
        nombre,
        apellido1,
        apellido2: apellido2 || '',
        talla: talla as any,
        pagado: false,
        fechaPagado: '',
        recogido: false,
        fechaRecogido: '',
    };

    const parseResult = MemberSchema.safeParse(newMember);
    if (!parseResult.success) {
        return { msg: 'Datos inválidos' };
    }

    try {
        const pipeline = redis.pipeline();
        pipeline.zadd(MEMBERS_KEY, { score: Date.now(), member: id });
        pipeline.hset(`${NAMESPACE}:miembro:${id}`, newMember);
        await pipeline.exec();

        revalidatePath('/');
        revalidatePath('/admin');
        return { success: true };
    } catch {
        return { msg: 'Error al guardar en base de datos' };
    }
}

export async function bulkAddMembers(textData: string) {
    try {
        const lines = textData.split('\n').filter(line => line.trim() !== '');

        // 1. Validation Phase
        const pendingMembers: { num: number, data: string }[] = [];
        const seenNumbers = new Set<number>();
        const duplicateNumbers: number[] = [];

        for (const line of lines) {
            // Sanitize invisible chars (U+2060 Word Joiner, U+200B Zero Width Space, U+FEFF BOM)
            const trimmed = line.replace(/[\u2060\u200B\uFEFF]/g, '').trim();
            // Match leading number: "1.", "122.", "15 -"
            const match = trimmed.match(/^(\d+)[.)-]?\s*(.*)/);

            let num = 0;
            let content = trimmed;

            if (match) {
                num = parseInt(match[1], 10);
                content = match[2];
                if (seenNumbers.has(num)) {
                    duplicateNumbers.push(num);
                }
                seenNumbers.add(num);
            }

            pendingMembers.push({ num, data: content });
        }

        if (duplicateNumbers.length > 0) {
            const uniqueDups = Array.from(new Set(duplicateNumbers)).join(', ');
            return { error: `Error: Números duplicados detectados: ${uniqueDups}. Por favor corrige la lista.` };
        }

        // 2. Insertion Phase
        const pipeline = redis.pipeline();
        let count = 0;
        const baseScore = Date.now();

        for (const item of pendingMembers) {
            // Clean "-->", "->", "-", "—>", "—" separators (Em dash, En dash)
            let cleanLine = item.data.replace(/[-—–]+>/g, ' ').replace(/[-—–]/g, ' ');

            // Regex strategies for Talla
            // 1. Explicit "Talla X" (e.g. "Carmen ... Talla 2")
            const tallaExplicit = cleanLine.match(/^(.*)\s+Talla\s+([0-9]+(?:\s*a[ñn]os)?)$/i);
            // 2. Age based "X anos" (e.g. "Luca 3 anos")
            const tallaAge = cleanLine.match(/^(.*)\s+([0-9]+\s*a[ñn]os)$/i);
            // 3. Standard S/M/L or just last word if no other match

            let tallaStr = '';
            let namePart = '';

            if (tallaExplicit) {
                namePart = tallaExplicit[1];
                tallaStr = tallaExplicit[2]; // e.g. "2"
                // Normalize "2" to "2 AÑOS" if user implies it? User said "talla es 3 años" for "3 anos".
                // But for "Talla 2" said "talla 2 años".
                // I'll append " AÑOS" if it's just a number to be safe/consistent with child sizes?
                // Or keep as is. "2" is clean. "3 anos" -> "3 ANOS". 
                // Let's just keep captured string but uppercase.
            } else if (tallaAge) {
                namePart = tallaAge[1];
                tallaStr = tallaAge[2];
            } else {
                // Fallback to splitting last token
                const lastSpace = cleanLine.lastIndexOf(' ');
                if (lastSpace > 0) {
                    namePart = cleanLine.substring(0, lastSpace);
                    tallaStr = cleanLine.substring(lastSpace + 1);
                } else {
                    // One word line? invalid
                    continue;
                }
            }

            // Normalization: XXL -> 2XL, XXXL -> 3XL
            let finalTalla = tallaStr.toUpperCase().replace('ANOS', 'AÑOS');
            if (finalTalla === 'XXL') finalTalla = '2XL';
            if (finalTalla === 'XXXL' || finalTalla === '3XL') finalTalla = '3XL'; // Ensure variants map to 3XL

            const talla = finalTalla;
            const parts = namePart.trim().split(/\s+/);
            // We need at least Nombre and Apellido1?
            // "Luca 3 anos" -> NamePart: "Luca". Parts: ["Luca"].
            // User example: "127. Luca 3 anos". Result: "se llama luca". Apellido? 
            // If only one word, treat as Nombre (surname empty? Schema requires Apellido1 min 2).
            // But Schema validation will fail if Apellido1 missing.
            // I should handle "Luca" -> Nombre="Luca", Apellido1="-" or something to pass validation?
            // Or maybe "Luca" is just Nombre and Apellido1 is missing?
            // Example 2: "Carmen junior". Parts: ["Carmen", "junior"]. Ap: "junior". Nom: "Carmen". Good.

            let apellido2 = '';
            let apellido1 = '';
            let nombre = '';

            if (parts.length >= 2) {
                apellido2 = parts.length >= 3 ? parts.pop() || '' : '';
                apellido1 = parts.pop() || '';
                nombre = parts.join(' ');
            } else if (parts.length === 1) {
                nombre = parts[0];
                apellido1 = '.'; // Placeholder to pass validation? 
                // User said "Luca... inserta los demas datos bien".
                // If Luca has no surname in input, system can't invent it.
                // Converting specific case "Luca" -> Ap1="."
            } else {
                continue;
            }

            const id = crypto.randomUUID();
            const hasExplicitOrder = item.num > 0;
            // Use explicit number if available, else timestamp-based
            const score = hasExplicitOrder ? item.num : (baseScore + count);
            const orderValue = hasExplicitOrder ? item.num : undefined;

            const newMember: Member = {
                id,
                nombre,
                apellido1,
                apellido2: apellido2 || '',
                talla: talla as any,
                pagado: false,
                fechaPagado: '',
                recogido: false,
                fechaRecogido: '',
                // Only include order if strictly defined (Redis HSET fix)
                ...(hasExplicitOrder ? { order: item.num } : {})
            };

            pipeline.zadd(MEMBERS_KEY, { score, member: id });
            pipeline.hset(`${NAMESPACE}:miembro:${id}`, newMember);
            count++;
        }

        if (count > 0) {
            await pipeline.exec();
            revalidatePath('/');
            revalidatePath('/admin');
        }
        return { success: true, count };
    } catch (error) {
        return { error: `Error en carga masiva: ${error instanceof Error ? error.message : String(error)}` };
    }
}

export async function deleteAllMembers() {
    try {
        const ids = await redis.zrange(MEMBERS_KEY, 0, -1);
        if (ids.length > 0) {
            const pipeline = redis.pipeline();
            pipeline.del(MEMBERS_KEY);
            ids.forEach(id => {
                pipeline.del(`${NAMESPACE}:miembro:${id}`);
            });
            await pipeline.exec();
        }
        revalidatePath('/');
        revalidatePath('/admin');
        return { success: true };
    } catch {
        return { error: 'Error al borrar todo' };
    }
}

export async function toggleStatus(id: string, field: 'pagado' | 'recogido', currentValue: boolean) {
    try {
        const memberKey = `${NAMESPACE}:miembro:${id}`;
        const newValue = !currentValue;
        const now = new Date().toISOString();
        const dateField = field === 'pagado' ? 'fechaPagado' : 'fechaRecogido';
        const dateValue = newValue ? now : '';

        await redis.hset(memberKey, {
            [field]: newValue,
            [dateField]: dateValue
        });

        revalidatePath('/');
        revalidatePath('/admin');
        return { success: true };
    } catch {
        throw new Error(`Failed to toggle ${field}`);
    }
}

const ANNOUNCEMENT_KEY = `${NAMESPACE}:anuncio`;

export async function getAnnouncement() {
    try {
        const text = await redis.get(ANNOUNCEMENT_KEY);
        return text || '';
    } catch {
        return '';
    }
}

export async function updateAnnouncement(text: string) {
    try {
        if (!text.trim()) {
            await redis.del(ANNOUNCEMENT_KEY);
        } else {
            await redis.set(ANNOUNCEMENT_KEY, text);
        }
        revalidatePath('/');
        revalidatePath('/admin');
        return { success: true };
    } catch {
        return { success: false, error: 'Error al actualizar el anuncio' };
    }
}

// --- CHAT GLOBAL ACTIONS ---

const CHAT_KEY = 'fiesta:chat';

export interface ChatMessage {
    id: string;
    nombre: string;
    mensaje: string;
    fecha: number;
}

export async function sendChatMessage(nombre: string, mensaje: string) {
    if (!nombre.trim() || !mensaje.trim()) return;

    // Sanitize basic inputs
    const safeNombre = nombre.slice(0, 30);
    const safeMensaje = mensaje.slice(0, 500);

    const msg: ChatMessage = {
        id: crypto.randomUUID(),
        nombre: safeNombre,
        mensaje: safeMensaje,
        fecha: Date.now()
    };

    try {
        // LPUSH to start of list
        await redis.lpush(CHAT_KEY, JSON.stringify(msg));
        // LTRIM to keep only last 50 messages (indices 0 to 49)
        await redis.ltrim(CHAT_KEY, 0, 49);

        revalidatePath('/');
        return { success: true };
    } catch (e) {
        throw e;
    }
}

export async function getChatMessages(): Promise<ChatMessage[]> {
    noStore();
    try {
        // Get all messages (0 to 49 since we trim)
        const rawMsgs = await redis.lrange(CHAT_KEY, 0, 49);
        // They come out as strings, parse them
        return rawMsgs.map((s: string) => JSON.parse(s)) as ChatMessage[];
    } catch {
        return [];
    }
}

// --- BEER GAME ACTIONS ---

const HIGHSCORE_KEY = 'fiesta:highscore';

export interface HighScore {
    name: string;
    score: number;
}

export async function getHighScore(): Promise<HighScore | null> {
    noStore();
    try {
        const data = await redis.get(HIGHSCORE_KEY);
        if (!data) return null;
        return typeof data === 'object' ? data as HighScore : JSON.parse(data as string);
    } catch {
        return null;
    }
}

export async function saveHighScore(name: string, score: number) {
    try {
        // Atomic Lua script to prevent race conditions
        // logic: fetch current -> decode -> compare -> set if higher
        const script = `
            local key = KEYS[1]
            local newScore = tonumber(ARGV[1])
            local newName = ARGV[2]

            local currentData = redis.call('get', key)
            local currentScore = 0

            if currentData then
                local decoded = cjson.decode(currentData)
                currentScore = tonumber(decoded.score) or 0
            end

            if newScore > currentScore then
                local newData = cjson.encode({name = newName, score = newScore})
                redis.call('set', key, newData)
                return 1
            else
                return 0
            end
        `;

        const result = await redis.eval(script, [HIGHSCORE_KEY], [score, name.slice(0, 20)]);
        const isNewRecord = result === 1;

        if (isNewRecord) {
            revalidatePath('/');
        }

        return { success: true, newRecord: isNewRecord };
    } catch (e) {
        console.error('Error saving high score:', e);
        return { success: false };
    }
}
const TOTAL_GAMES_KEY = 'fiesta:total_games';

export async function getTotalGames(): Promise<number> {
    noStore();
    try {
        const count = await redis.get(TOTAL_GAMES_KEY);
        return count ? parseInt(count as string, 10) : 0;
    } catch {
        return 0;
    }
}

export async function incrementTotalGames(): Promise<number> {
    try {
        const newCount = await redis.incr(TOTAL_GAMES_KEY);
        revalidatePath('/');
        return newCount;
    } catch {
        return 0;
    }
}
