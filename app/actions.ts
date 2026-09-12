'use server';

import { redis } from '@/lib/redis';
import { headers } from 'next/headers';
import { isAdmin } from '@/lib/admin-auth';
import { clientIpFromHeaders, rateLimited } from '@/lib/rate-limit';
import {
    type Aposta,
    type ApostasBoleto,
    type LadoAposta,
    type Boleto,
    type EstadoBoleto,
    MAX_APOSTA,
    MAX_CUOTA,
    MAX_IMPORTE,
    MAX_LINEAS,
    MIN_CUOTA,
    SALDO_INICIAL,
    fechaBoleto,
    mercadoBoleto,
    multiplicadorAposta,
} from '@/lib/lupebet';
import { fotoId } from '@/lib/fotos';
import { basePorId, emojiValido, type LugarGardado, type LugaresGardados } from '@/lib/lugares';
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

// Los server actions son endpoints POST reales: que el botón solo se pinte en
// /gestion no protege nada, la comprobación tiene que estar aquí.
const isAdminRequest = isAdmin;

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

/** Normaliza la talla como la carga masiva: "xxl" → 2XL, "3 anos" → 3 AÑOS. */
function normalizaTalla(entrada: string): string {
    const t = entrada.trim().toUpperCase().replace('ANOS', 'AÑOS');
    if (t === 'XXL') return '2XL';
    if (t === 'XXXL') return '3XL';
    return t;
}

/**
 * Alta de UNA persona. La carga masiva es para pegar la lista entera; para
 * añadir a alguien que llega tarde no hace falta pasar por el textarea (y
 * repegar la lista duplicaba a todo el mundo).
 */
export async function addMember(
    nombreCompleto: string,
    tallaEntrada: string,
): Promise<{ success?: true; nombre?: string; orden?: number; error?: string }> {
    if (!(await isAdminRequest())) return { error: 'No autorizado' };

    const partes = String(nombreCompleto || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
    if (partes.length === 0) return { error: 'Falta el nombre.' };

    const talla = normalizaTalla(String(tallaEntrada || ''));
    if (!talla) return { error: 'Falta la talla.' };

    // Mismo reparto que la carga masiva: el último apellido va a apellido2 y,
    // si solo hay una palabra, apellido1 queda como "." para pasar el schema.
    let nombre = '';
    let apellido1 = '';
    let apellido2 = '';

    if (partes.length >= 2) {
        apellido2 = partes.length >= 3 ? partes.pop() || '' : '';
        apellido1 = partes.pop() || '';
        nombre = partes.join(' ');
    } else {
        nombre = partes[0];
        apellido1 = '.';
    }

    const nuevo: Member = {
        id: crypto.randomUUID(),
        nombre: nombre.slice(0, 40),
        apellido1: apellido1.slice(0, 40),
        apellido2: apellido2.slice(0, 40),
        talla: talla.slice(0, 12),
        pagado: false,
        fechaPagado: '',
        recogido: false,
        fechaRecogido: '',
    };

    // Un nombre de una sola palabra deja apellido1 en ".", que el schema normal
    // rechaza por corto. Es un caso real de la lista (críos), así que se valida
    // con el mínimo relajado en ese campo y nada más.
    const parsed = MemberSchema.extend({ apellido1: z.string().min(1) }).safeParse(nuevo);
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos.' };
    }

    try {
        // Va al final de la lista: el número siguiente al último que haya.
        const actuales = await getMembers();
        const orden = actuales.reduce((n, m) => Math.max(n, m.order ?? 0), 0) + 1;
        const conOrden = { ...nuevo, order: orden };

        await redis.zadd(MEMBERS_KEY, { score: orden, member: nuevo.id });
        await redis.hset(`${NAMESPACE}:miembro:${nuevo.id}`, conOrden);

        revalidatePath('/');
        revalidatePath('/gestion');
        revalidatePath('/lista');
        return { success: true, nombre: `${nuevo.nombre} ${nuevo.apellido1}`.trim(), orden };
    } catch {
        return { error: 'No se pudo guardar. Inténtalo otra vez.' };
    }
}

export async function bulkAddMembers(textData: string) {
    if (!(await isAdminRequest())) return { error: 'No autorizado' };

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
            revalidatePath('/gestion');
        }
        return { success: true, count };
    } catch (error) {
        return { error: `Error en carga masiva: ${error instanceof Error ? error.message : String(error)}` };
    }
}

export async function deleteAllMembers() {
    if (!(await isAdminRequest())) return { error: 'No autorizado' };

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
        revalidatePath('/gestion');
        return { success: true };
    } catch {
        return { error: 'Error al borrar todo' };
    }
}

export async function toggleStatus(id: string, field: 'pagado' | 'recogido', currentValue: boolean) {
    // Este action ya señaliza errores lanzando (ver su catch), y el llamador
    // los captura para avisar y pedir recarga. Mantenemos ese contrato.
    if (!(await isAdminRequest())) throw new Error('No autorizado');

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
        revalidatePath('/gestion');
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
    if (!(await isAdminRequest())) return { success: false, error: 'No autorizado' };

    try {
        if (!text.trim()) {
            await redis.del(ANNOUNCEMENT_KEY);
        } else {
            await redis.set(ANNOUNCEMENT_KEY, text);
        }
        revalidatePath('/');
        revalidatePath('/gestion');
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

const HIGHSCORE_KEY = 'fiesta:highscore';   // (vello) STRING co récord
// Ranking do xogo: ZSET nome -> puntuación. Cun só comando sácase o récord
// (o primeiro) ou o top 5, e gárdase con GT: só sobe se melloras a túa marca.
const XOGO_TOP_KEY = 'fiesta:xogo_top';

export interface HighScore {
    name: string;
    score: number;
}

export async function getHighScore(): Promise<HighScore | null> {
    noStore();
    try {
        const top = (await redis.zrange(XOGO_TOP_KEY, 0, 0, { rev: true, withScores: true })) as (string | number)[];
        if (!top || top.length < 2) return null;
        return { name: String(top[0]), score: Number(top[1]) || 0 };
    } catch {
        return null;
    }
}

/** O top do xogo, cun só comando. Empatados, mándaos Redis por orde alfabética. */
export async function getRankingXogo(limit = 5): Promise<HighScore[]> {
    noStore();
    try {
        const plano = (await redis.zrange(XOGO_TOP_KEY, 0, limit - 1, { rev: true, withScores: true })) as (string | number)[];
        const saida: HighScore[] = [];
        for (let i = 0; i < (plano?.length ?? 0); i += 2) {
            saida.push({ name: String(plano[i]), score: Number(plano[i + 1]) || 0 });
        }
        return saida;
    } catch {
        return [];
    }
}

export async function saveHighScore(name: string, score: number) {
    const puntos = Math.floor(Number(score));
    const quen = String(name ?? '').trim().slice(0, 20) || 'Anónimo';
    if (!Number.isFinite(puntos) || puntos <= 0) return { success: false };

    try {
        // `gt: true` deixa a mellor marca de cada quen sen ter que lela antes.
        await redis.zadd(XOGO_TOP_KEY, { gt: true }, { score: puntos, member: quen });

        const top = await getHighScore();
        const newRecord = Boolean(top && top.name === quen && top.score === puntos);
        if (newRecord) revalidatePath('/');

        return { success: true, newRecord };
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

// --- COLOR / PALETA DE LA PEÑA ---

const PENA_COLOR_KEY = `${NAMESPACE}:color`;

export async function getPenaColor(): Promise<string> {
    try {
        const color = await redis.get(PENA_COLOR_KEY);
        return (color as string) || 'verde';
    } catch {
        return 'verde';
    }
}

export async function setPenaColor(key: string) {
    if (!(await isAdminRequest())) return { success: false, error: 'No autorizado' };

    try {
        await redis.set(PENA_COLOR_KEY, key);
        // Afecta a toda la app (nav, títulos, chat...) → revalidar todo.
        revalidatePath('/', 'layout');
        return { success: true };
    } catch {
        return { success: false, error: 'Error al guardar el color' };
    }
}

// --- FOTOS / MURAL DE RECUERDOS ---

const FOTOS_KEY = `${NAMESPACE}:fotos`;
// Contadores que solo suben, para las insignias del menú: comparar dos números
// es mucho más barato que leer la lista y contar cuántos son nuevos.
const FOTOS_N_KEY = `${NAMESPACE}:fotos_n`;
// Quién subió cada foto, para que pueda borrarla. Va en su propia HASH y NUNCA
// sale al cliente: el anonId es la llave de las moedas de esa persona, y
// publicarlo en la lista de fotos sería regalar su identidad a cualquiera.
const FOTOS_AUTOR_KEY = `${NAMESPACE}:fotos_autor`;
const CHAT_N_KEY = `${NAMESPACE}:chat_n`;
// Los 🔥 van en sus propias keys: la lista de fotos no se puede reescribir por
// cada toque (mismo criterio que el estado de los boletos).
const FOTOS_LIKES_KEY = `${NAMESPACE}:fotos_likes`;        // HASH fotoId -> nº
const FOTOS_LIKES_DE = `${NAMESPACE}:fotos_like_de:`;      // SET por dispositivo

export interface Foto {
    url: string;
    ts: number;
    /** Pie de foto, opcional: quien sube decide si le pone algo o no. */
    titulo?: string;
}

// El nombre de quien sube NO se guarda: el mural es anónimo. Lo único que se
// apunta es el anonId, aparte y en el servidor, para que esa persona pueda
// borrar su foto (ver FOTOS_AUTOR_KEY).
export async function addFoto(url: string, titulo?: string, anonId?: string) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        return { success: false };
    }
    try {
        const pie = (titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
        const foto: Foto = {
            url: url.slice(0, 500),
            ts: Date.now(),
            ...(pie ? { titulo: pie } : {}),
        };
        await redis.lpush(FOTOS_KEY, JSON.stringify(foto));
        await redis.ltrim(FOTOS_KEY, 0, 299); // conserva las últimas 300
        await redis.incr(FOTOS_N_KEY);

        const dono = limpiaAnonId(anonId);
        const id = fotoId(foto.url);
        if (dono && id) await redis.hset(FOTOS_AUTOR_KEY, { [id]: dono });
        revalidatePath('/recuerdos');
        return { success: true };
    } catch {
        return { success: false };
    }
}

/**
 * Borrar una foto: el admin, cualquiera; el resto, solo las suyas. Se lleva por
 * delante el fichero en Blob y el contador de 🔥, que si no quedan ahí colgados.
 */
export async function deleteFoto(url: string, anonId?: string): Promise<{ success?: true; error?: string }> {
    const id = fotoId(url);
    if (!id) return { error: 'Foto non válida.' };

    try {
        const admin = await isAdminRequest();
        if (!admin) {
            const dono = limpiaAnonId(anonId);
            const gardado = await redis.hget<string>(FOTOS_AUTOR_KEY, id);
            if (!dono || !gardado || String(gardado) !== dono) {
                return { error: 'Esa foto non é túa.' };
            }
        }

        // La lista se reescribe entera, como el chat: son 300 como mucho.
        const raw = await redis.lrange(FOTOS_KEY, 0, 299);
        const quedan = raw
            .map((s: string | object) => {
                try {
                    return typeof s === 'object' ? (s as Foto) : (JSON.parse(s) as Foto);
                } catch {
                    return null;
                }
            })
            .filter((f): f is Foto => Boolean(f && f.url && fotoId(f.url) !== id));

        await redis.del(FOTOS_KEY);
        if (quedan.length > 0) {
            await redis.rpush(FOTOS_KEY, ...quedan.map((f) => JSON.stringify(f)));
        }

        await redis.hdel(FOTOS_LIKES_KEY, id);
        await redis.hdel(FOTOS_AUTOR_KEY, id);

        // El fichero de Blob, aparte: si esto falla, la foto ya no se ve igual.
        try {
            const { del } = await import('@vercel/blob');
            await del(url);
        } catch {
            // sin token o ya borrado: no rompe el borrado de la lista
        }

        revalidatePath('/recuerdos');
        return { success: true };
    } catch {
        return { error: 'Non se puido borrar a foto.' };
    }
}

/** Qué fotos subió ESTE móvil, para enseñarle a él la papelera. */
export async function getMinasFotos(anonId: string): Promise<string[]> {
    noStore();
    const dono = limpiaAnonId(anonId);
    if (!dono) return [];
    try {
        const todo = await redis.hgetall<Record<string, string>>(FOTOS_AUTOR_KEY);
        if (!todo) return [];
        return Object.entries(todo)
            .filter(([, v]) => String(v) === dono)
            .map(([k]) => k);
    } catch {
        return [];
    }
}

/** Cuántos 🔥 tiene cada foto. Una sola lectura para todo el mural. */
export async function getLikes(): Promise<Record<string, number>> {
    noStore();
    try {
        const raw = await redis.hgetall<Record<string, string | number>>(FOTOS_LIKES_KEY);
        if (!raw) return {};
        const salida: Record<string, number> = {};
        for (const [id, v] of Object.entries(raw)) {
            const n = Number(v) || 0;
            if (n > 0) salida[id] = n;
        }
        return salida;
    } catch {
        return {};
    }
}

/** A cuáles les ha dado 🔥 este móvil, para pintarlas encendidas. */
export async function getMeusLikes(anonId: string): Promise<string[]> {
    noStore();
    const id = limpiaAnonId(anonId);
    if (!id) return [];
    try {
        const ids = await redis.smembers(`${FOTOS_LIKES_DE}${id}`);
        return (ids ?? []).map(String);
    } catch {
        return [];
    }
}

/**
 * Dar o quitar el 🔥. El SET del dispositivo es lo que decide: si el `sadd`
 * dice que ya estaba, se quita. Así no hay forma de sumar dos veces desde el
 * mismo móvil aunque se pulse rápido.
 */
export async function toggleLike(
    anonId: string,
    fotoId: string,
): Promise<{ liked?: boolean; likes?: number; error?: string }> {
    const id = limpiaAnonId(anonId);
    if (!id) return { error: 'Non se puido identificar o dispositivo.' };
    if (!/^[A-Za-z0-9._-]{1,120}$/.test(fotoId)) return { error: 'Foto non válida.' };

    const ip = clientIpFromHeaders(await headers());
    if (await rateLimited('like', ip, 600, 60 * 60)) {
        return { error: 'Demasiados toques seguidos.' };
    }

    try {
        const key = `${FOTOS_LIKES_DE}${id}`;
        const engadido = await redis.sadd(key, fotoId);

        let likes: number;
        if (engadido) {
            likes = await redis.hincrby(FOTOS_LIKES_KEY, fotoId, 1);
        } else {
            await redis.srem(key, fotoId);
            likes = await redis.hincrby(FOTOS_LIKES_KEY, fotoId, -1);
            if (likes < 0) {
                await redis.hset(FOTOS_LIKES_KEY, { [fotoId]: 0 });
                likes = 0;
            }
        }

        return { liked: Boolean(engadido), likes };
    } catch {
        return { error: 'Non se puido gardar.' };
    }
}

/**
 * Todo lo que necesitan las insignias del menú, en UNA llamada: cuánta gente
 * comparte ubicación ahora mismo y los contadores de chat y fotos. Lo pide solo
 * `BottomNav` y lo reparte por `lib/avisos.ts`.
 */
export async function getAvisos(): Promise<{ ubicacions: number; chatN: number; fotosN: number }> {
    noStore();
    try {
        const [cantos, contadores] = await Promise.all([
            redis.zcount(LOC_Z, Date.now(), '+inf'),
            redis.mget<(string | number | null)[]>(CHAT_N_KEY, FOTOS_N_KEY),
        ]);

        return {
            ubicacions: Number(cantos) || 0,
            chatN: Number(contadores?.[0]) || 0,
            fotosN: Number(contadores?.[1]) || 0,
        };
    } catch {
        return { ubicacions: 0, chatN: 0, fotosN: 0 };
    }
}

export async function getFotos(): Promise<Foto[]> {
    noStore();
    try {
        const raw = await redis.lrange(FOTOS_KEY, 0, 299);
        return raw
            .map((s: string | object) => {
                try {
                    const f = (typeof s === 'object' ? s : JSON.parse(s)) as Foto & { autor?: string };
                    if (!f?.url) return null;
                    // Se copian los campos a mano: las fotos subidas antes de
                    // esto llevan dentro el nombre de quien la subió, y el mural
                    // es anónimo. Así no sale de aquí.
                    return { url: f.url, ts: f.ts, ...(f.titulo ? { titulo: f.titulo } : {}) } as Foto;
                } catch {
                    return null;
                }
            })
            .filter(Boolean) as Foto[];
    } catch {
        return [];
    }
}

// --- UBICACIONES ANÓNIMAS (MAPA) ---

const LOC_PREFIX = `${NAMESPACE}:loc:`;
// Índice como ZSET puntuado pola CADUCIDADE (epoch ms). Así contar cuántos
// comparten agora é UN comando (zcount) e listalos son DOUS (zrange + mget),
// haxa unha persoa ou vinte. Antes era un GET por persoa, e págase por comando.
const LOC_Z = `${NAMESPACE}:loc_z`;

// TTL del punto en Redis. Puntual: 15/30/60 min. Directo: valor corto (red de
// seguridad si el cliente muere; la duración real la controla el cliente).
const DEFAULT_TTL = 1800; // 30 min
const MIN_TTL = 30;
const MAX_TTL = 8 * 60 * 60;

export interface AnonLocation {
    lat: number;
    lng: number;
    ts: number;
    name?: string;
    color?: string;
    live?: boolean;
}

export interface MapPoint {
    lat: number;
    lng: number;
    ts: number;
    name?: string;
    color?: string;
    live?: boolean;
}

export async function shareLocation(
    anonId: string,
    lat: number,
    lng: number,
    name?: string,
    color?: string,
    ttlSeconds?: number,
    live?: boolean,
) {
    // Validación básica de coordenadas
    if (
        typeof lat !== 'number' || typeof lng !== 'number' ||
        Number.isNaN(lat) || Number.isNaN(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180 || !anonId
    ) {
        return { success: false };
    }
    try {
        const id = anonId.slice(0, 40);
        const ttl = Math.min(Math.max(Math.floor(ttlSeconds ?? DEFAULT_TTL), MIN_TTL), MAX_TTL);
        const payload: AnonLocation = { lat, lng, ts: Date.now() };
        const cleanName = (name ?? '').trim().slice(0, 24);
        if (cleanName) payload.name = cleanName;
        const cleanColor = (color ?? '').trim().slice(0, 24);
        if (cleanColor) payload.color = cleanColor;
        if (live) payload.live = true;

        await redis.set(`${LOC_PREFIX}${id}`, JSON.stringify(payload), { ex: ttl });
        await redis.zadd(LOC_Z, { score: Date.now() + ttl * 1000, member: id });
        return { success: true };
    } catch {
        return { success: false };
    }
}

export async function removeLocation(anonId: string) {
    try {
        const id = anonId.slice(0, 40);
        await redis.del(`${LOC_PREFIX}${id}`);
        await redis.zrem(LOC_Z, id);
        // De paso, tirar os caducados: quitar o punto é raro, e nas lecturas
        // (que van a cada rato) así non hai que limpar nada.
        await redis.zremrangebyscore(LOC_Z, 0, Date.now());
        return { success: true };
    } catch {
        return { success: false };
    }
}

/** Devuelve coordenadas + nombre/color opcionales. Sin IDs (no se sabe qué punto es de quién salvo por el nombre que cada uno elija poner). */
export async function getLocations(): Promise<MapPoint[]> {
    noStore();
    try {
        // Dous comandos e punto: os ids que aínda non caducaron, e os seus
        // puntos dunha soa vez.
        const ids = (await redis.zrange(LOC_Z, Date.now(), '+inf', { byScore: true })) as string[];
        if (!ids || ids.length === 0) return [];

        const raws = await redis.mget<(AnonLocation | string | null)[]>(
            ...ids.map((id) => `${LOC_PREFIX}${id}`),
        );

        const points: MapPoint[] = [];
        (raws ?? []).forEach((raw) => {
            if (raw == null) return;   // caducou entre o índice e a lectura
            try {
                const loc = typeof raw === 'string' ? (JSON.parse(raw) as AnonLocation) : (raw as AnonLocation);
                if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
                    points.push({ lat: loc.lat, lng: loc.lng, ts: loc.ts, name: loc.name, color: loc.color, live: loc.live });
                }
            } catch {
                // un punto corrupto non pode tirar o mapa enteiro
            }
        });

        return points;
    } catch {
        return [];
    }
}

// --- AUDIOS DA PEÑA ---
// Mesmo molde que as fotos: LIST de JSON + HASH co dono para que cada quen
// poida borrar o seu. A diferenza é que aquí o título NON é opcional (unha
// canción sen nome nunha lista non lle di nada a ninguén) e que se garda a URL
// de descarga que devolve Blob, que é a que obriga ao navegador a gardar o
// ficheiro en vez de poñerse a reproducilo.

const AUDIOS_KEY = `${NAMESPACE}:audios`;
const AUDIOS_AUTOR_KEY = `${NAMESPACE}:audios_autor`;
const AUDIOS_MAX = 99;   // son cancións, non fotos: con cen vai sobrado

export interface AudioPena {
    url: string;
    ts: number;
    titulo: string;
    /** URL que forza a descarga (a que devolve Blob ao subir). */
    descarga?: string;
}

export async function getAudios(): Promise<AudioPena[]> {
    noStore();
    try {
        const raw = await redis.lrange(AUDIOS_KEY, 0, AUDIOS_MAX);
        return raw
            .map((s: string | object) => {
                try {
                    return typeof s === 'object' ? (s as AudioPena) : (JSON.parse(s) as AudioPena);
                } catch {
                    return null;
                }
            })
            // Campo a campo, como en getFotos: así non se escapa nada que se
            // gardase de máis nalgún momento.
            .filter((a): a is AudioPena => Boolean(a && a.url))
            .map(a => ({
                url: a.url,
                ts: a.ts,
                titulo: a.titulo || 'Sen título',
                ...(a.descarga ? { descarga: a.descarga } : {}),
            }));
    } catch {
        return [];
    }
}

export async function addAudio(url: string, titulo: string, anonId?: string, descarga?: string) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        return { success: false };
    }
    try {
        const nome = (titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Sen título';
        const audio: AudioPena = {
            url: url.slice(0, 500),
            ts: Date.now(),
            titulo: nome,
            ...(descarga && descarga.startsWith('http') ? { descarga: descarga.slice(0, 500) } : {}),
        };
        await redis.lpush(AUDIOS_KEY, JSON.stringify(audio));
        await redis.ltrim(AUDIOS_KEY, 0, AUDIOS_MAX);

        const dono = limpiaAnonId(anonId);
        const id = fotoId(audio.url);   // é o nome do ficheiro en Blob, vale igual
        if (dono && id) await redis.hset(AUDIOS_AUTOR_KEY, { [id]: dono });
        revalidatePath('/recuerdos');
        return { success: true };
    } catch {
        return { success: false };
    }
}

/** Borrar un audio: o admin, calquera; o resto, só os seus. */
export async function deleteAudio(url: string, anonId?: string): Promise<{ success?: true; error?: string }> {
    const id = fotoId(url);
    if (!id) return { error: 'Audio non válido.' };

    try {
        const admin = await isAdminRequest();
        if (!admin) {
            const dono = limpiaAnonId(anonId);
            const gardado = await redis.hget<string>(AUDIOS_AUTOR_KEY, id);
            if (!dono || !gardado || String(gardado) !== dono) {
                return { error: 'Ese audio non é teu.' };
            }
        }

        const raw = await redis.lrange(AUDIOS_KEY, 0, AUDIOS_MAX);
        const quedan = raw
            .map((s: string | object) => {
                try {
                    return typeof s === 'object' ? (s as AudioPena) : (JSON.parse(s) as AudioPena);
                } catch {
                    return null;
                }
            })
            .filter((a): a is AudioPena => Boolean(a && a.url && fotoId(a.url) !== id));

        await redis.del(AUDIOS_KEY);
        if (quedan.length > 0) {
            await redis.rpush(AUDIOS_KEY, ...quedan.map((a) => JSON.stringify(a)));
        }
        await redis.hdel(AUDIOS_AUTOR_KEY, id);

        try {
            const { del } = await import('@vercel/blob');
            await del(url);
        } catch {
            // sen token ou xa borrado: non rompe o borrado da lista
        }

        revalidatePath('/recuerdos');
        return { success: true };
    } catch {
        return { error: 'Non se puido borrar o audio.' };
    }
}

/** Que audios subiu ESTE móbil, para ensinarlle a el a papeleira. */
export async function getMeusAudios(anonId: string): Promise<string[]> {
    noStore();
    const dono = limpiaAnonId(anonId);
    if (!dono) return [];
    try {
        const todo = await redis.hgetall<Record<string, string>>(AUDIOS_AUTOR_KEY);
        if (!todo) return [];
        return Object.entries(todo)
            .filter(([, v]) => String(v) === dono)
            .map(([k]) => k);
    } catch {
        return [];
    }
}

// --- SITIOS DA FESTA (as chinchetas fixas do mapa) ---
// Os NOMES son datos do cartel (lib/lugares.ts). O que se garda aquí é só
// ONDE cae cada un e con que icona: colócao o admin tocando no mapa, porque
// ningunha destas prazas ten unha coordenada que se poida mirar nun sitio.

const LUGARES_KEY = `${NAMESPACE}:lugares`;   // HASH id -> {lat,lng,emoji}

/** Un só comando (HGETALL) e cabe todo: son doce sitios como moito. */
export async function getLugares(): Promise<LugaresGardados> {
    try {
        const raw = await redis.hgetall<Record<string, LugarGardado | string>>(LUGARES_KEY);
        if (!raw) return {};
        const out: LugaresGardados = {};
        for (const [id, valor] of Object.entries(raw)) {
            if (!basePorId(id)) continue;   // sitio que xa non está no cartel
            try {
                // @upstash/redis unhas veces devolve o JSON xa feito e outras o texto.
                const l = (typeof valor === 'string' ? JSON.parse(valor) : valor) as LugarGardado;
                if (l && typeof l.lat === 'number' && typeof l.lng === 'number') {
                    out[id] = { lat: l.lat, lng: l.lng, emoji: String(l.emoji ?? '📍') };
                }
            } catch {
                // un sitio corrupto non pode tirar o mapa enteiro
            }
        }
        return out;
    } catch {
        return {};
    }
}

export async function gardarLugar(id: string, lat: number, lng: number, emoji: string) {
    if (!(await isAdminRequest())) return { success: false, error: 'Non autorizado' };

    const base = basePorId(id);
    if (!base) return { success: false, error: 'Ese sitio non está no programa' };
    if (
        typeof lat !== 'number' || typeof lng !== 'number' ||
        !Number.isFinite(lat) || !Number.isFinite(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
        return { success: false, error: 'Coordenadas non válidas' };
    }
    // A icona ten que saír da paleta: acaba dentro do HTML da chincheta de
    // Leaflet, así que texto libre aquí sería un buraco.
    const icona = emojiValido(emoji) ? emoji : base.emoji;

    try {
        const valor: LugarGardado = { lat, lng, emoji: icona };
        await redis.hset(LUGARES_KEY, { [id]: JSON.stringify(valor) });
        revalidatePath('/');
        revalidatePath('/mapa');
        return { success: true };
    } catch {
        return { success: false, error: 'Non se puido gardar o sitio' };
    }
}

export async function borrarLugar(id: string) {
    if (!(await isAdminRequest())) return { success: false, error: 'Non autorizado' };
    if (!basePorId(id)) return { success: false, error: 'Ese sitio non está no programa' };

    try {
        await redis.hdel(LUGARES_KEY, id);
        revalidatePath('/');
        revalidatePath('/mapa');
        return { success: true };
    } catch {
        return { success: false, error: 'Non se puido quitar o sitio' };
    }
}

// --- LUPEBET: BOLETOS DE BROMA DE LA PEÑA ---
// El boleto oficial es el de la camiseta y vive en lib/lupebet.ts (datos, no
// Redis). Aquí solo se guardan los que se inventa la gente.

const BOLETOS_KEY = `${NAMESPACE}:boletos`;
const BOLETOS_MAX = 200;

const LineaSchema = z.object({
    apuesta: z.string().trim().min(3).max(90),
    pronostico: z.string().trim().max(40).default(''),
    cuota: z.coerce.number().min(MIN_CUOTA).max(MAX_CUOTA),
});

const NuevoBoletoSchema = z.object({
    titulo: z.string().trim().max(40).default('APUESTA COMBINADA'),
    nombre: z.string().trim().min(1).max(24),
    importe: z.coerce.number().min(1).max(MAX_IMPORTE),
    lineas: z.array(LineaSchema).min(1).max(MAX_LINEAS),
});

export type NuevoBoleto = z.input<typeof NuevoBoletoSchema>;

/** ID corto legible, del estilo del de la camiseta (LB-DDMMAA-NNNNNN). */
function nuevoIdBoleto(ts: number) {
    const d = new Date(ts);
    const p = (n: number) => String(n).padStart(2, '0');
    const fecha = `${p(d.getUTCDate())}${p(d.getUTCMonth() + 1)}${p(d.getUTCFullYear() % 100)}`;
    const n = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    return `LB-${fecha}-${n}`;
}

const CODIGO_ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I/O/0/1

function nuevoCodigo() {
    return Array.from({ length: 7 }, () => CODIGO_ALFABETO[Math.floor(Math.random() * CODIGO_ALFABETO.length)]).join('');
}

export async function createBoleto(input: NuevoBoleto): Promise<{ id?: string; error?: string }> {
    // Por IP y no por anonId: el identificador lo genera el cliente y se rota.
    const ip = clientIpFromHeaders(await headers());
    if (await rateLimited('boleto', ip, 30, 60 * 60)) {
        return { error: 'Demasiados boletos seguidos. Próbao noutro anaco.' };
    }

    const parsed = NuevoBoletoSchema.safeParse(input);
    if (!parsed.success) return { error: 'Revisa os datos do boleto.' };

    try {
        const ts = Date.now();
        const boleto: Boleto = {
            id: nuevoIdBoleto(ts),
            codigo: nuevoCodigo(),
            titulo: parsed.data.titulo || 'APUESTA COMBINADA',
            nombre: parsed.data.nombre,
            importe: parsed.data.importe,
            // Redondeo a 2 decimales: si no, 1.1*1.3 mete cola de flotante.
            lineas: parsed.data.lineas.map((l) => ({ ...l, cuota: Math.round(l.cuota * 100) / 100 })),
            fecha: fechaBoleto(ts),
            ts,
        };

        await redis.lpush(BOLETOS_KEY, JSON.stringify(boleto));
        await redis.ltrim(BOLETOS_KEY, 0, BOLETOS_MAX - 1);
        revalidatePath('/lupebet');
        return { id: boleto.id };
    } catch {
        return { error: 'Non se puido gardar o boleto.' };
    }
}

export async function getBoletos(): Promise<Boleto[]> {
    noStore();
    try {
        // El estado va en su propia HASH: marcarlo no tiene que reescribir la
        // lista entera de boletos.
        const [raw, estados, totales, cuantos, destacados] = await Promise.all([
            redis.lrange(BOLETOS_KEY, 0, BOLETOS_MAX - 1),
            redis.hgetall<Record<string, string>>(`${NAMESPACE}:boletos_estado`),
            redis.hgetall<Record<string, string | number>>(`${NAMESPACE}:apostas_total`),
            redis.hgetall<Record<string, string | number>>(`${NAMESPACE}:apostas_n`),
            redis.smembers(`${NAMESPACE}:boletos_destacados`),
        ]);
        const marcados = new Set((destacados ?? []).map(String));
        return raw
            .map((s: string | object) => {
                try {
                    return typeof s === 'object' ? (s as Boleto) : (JSON.parse(s) as Boleto);
                } catch {
                    return null;
                }
            })
            .filter((b): b is Boleto => Boolean(b?.id && Array.isArray(b?.lineas)))
            .map((b) => ({
                ...b,
                estado: (estados?.[b.id] as EstadoBoleto) ?? 'aberto',
                apostado: Number(totales?.[b.id]) || 0,
                apostantes: Number(cuantos?.[b.id]) || 0,
                destacado: marcados.has(b.id),
            }));
    } catch {
        return [];
    }
}

export async function getBoleto(id: string): Promise<Boleto | null> {
    if (!id) return null;
    const todos = await getBoletos();
    return todos.find((b) => b.id === id) ?? null;
}

/** Borrar un boleto (moderación). Reescribe la lista entera, como hace el chat. */
export async function deleteBoleto(id: string) {
    if (!(await isAdminRequest())) return { error: 'No autorizado' };

    try {
        const todos = await getBoletos();
        const quedan = todos.filter((b) => b.id !== id);
        if (quedan.length === todos.length) return { success: true };

        await redis.del(BOLETOS_KEY);
        if (quedan.length > 0) {
            // getBoletos devuelve del más nuevo al más viejo y lpush invierte.
            await redis.rpush(BOLETOS_KEY, ...quedan.map((b) => JSON.stringify(b)));
        }
        revalidatePath('/lupebet');
        return { success: true };
    } catch {
        return { error: 'Non se puido borrar o boleto.' };
    }
}

// --- LUPEBET: MOEDAS, APOSTAS E RESOLUCIÓN ---
// Sin cuentas de usuario: la identidad es el `anon_id` del navegador, el mismo
// que usa el mapa. No es auth — quien borre los datos vuelve a empezar. Para
// una peña de bromas es el trato aceptado.

const MOEDAS_KEY = `${NAMESPACE}:moedas`;          // HASH anonId -> saldo
const MOEDAS_NOME_KEY = `${NAMESPACE}:moedas_nome`; // HASH anonId -> nombre
const APOSTAS_PREFIX = `${NAMESPACE}:apostas:`;     // HASH anonId -> Aposta (JSON)
const ESTADOS_KEY = `${NAMESPACE}:boletos_estado`;  // HASH boletoId -> estado
const APOSTAS_TOTAL_KEY = `${NAMESPACE}:apostas_total`; // HASH boletoId -> moedas
const APOSTAS_N_KEY = `${NAMESPACE}:apostas_n`;         // HASH boletoId -> nº de apostantes
const DESTACADOS_KEY = `${NAMESPACE}:boletos_destacados`; // SET de boletoId destacados polo admin

function limpiaAnonId(id: unknown): string | null {
    if (typeof id !== 'string') return null;
    const v = id.trim().slice(0, 64);
    return v.length >= 8 ? v : null;
}

/** Saldo del dispositivo. Crea la cartera con SALDO_INICIAL la primera vez. */
export async function getSaldo(anonId: string): Promise<number> {
    noStore();
    const id = limpiaAnonId(anonId);
    if (!id) return 0;
    try {
        // hsetnx: si dos pestañas entran a la vez, solo una crea la cartera.
        await redis.hsetnx(MOEDAS_KEY, id, SALDO_INICIAL);
        const raw = await redis.hget<number | string>(MOEDAS_KEY, id);
        return Number(raw) || 0;
    } catch {
        return 0;
    }
}

/**
 * Quen es na LupeBet: saldo e o nome co que sae na clasificación. Non hai
 * contas — o nome é o mesmo do chat, gardado no navegador; aquí só se copia a
 * Redis para que a clasificación poida pintalo.
 */
export async function getPerfilMoedas(anonId: string): Promise<{ saldo: number; nome: string }> {
    noStore();
    const id = limpiaAnonId(anonId);
    if (!id) return { saldo: 0, nome: '' };

    const saldo = await getSaldo(id);
    try {
        const nome = await redis.hget<string>(MOEDAS_NOME_KEY, id);
        return { saldo, nome: nome ? String(nome) : '' };
    } catch {
        return { saldo, nome: '' };
    }
}

/** Fixa o nome do dispositivo para a clasificación (e crea a carteira). */
export async function gardarNomeMoedas(
    anonId: string,
    nombre: string,
): Promise<{ saldo?: number; nome?: string; error?: string }> {
    const id = limpiaAnonId(anonId);
    if (!id) return { error: 'Non se puido identificar o dispositivo.' };

    const nome = (nombre || '').trim().slice(0, 24);
    if (nome.length < 2) return { error: 'Ponte un nome de polo menos 2 letras.' };

    const ip = clientIpFromHeaders(await headers());
    if (await rateLimited('nome_moedas', ip, 40, 60 * 60)) {
        return { error: 'Demasiados cambios de nome. Próbao noutro anaco.' };
    }

    try {
        await redis.hsetnx(MOEDAS_KEY, id, SALDO_INICIAL);
        await redis.hset(MOEDAS_NOME_KEY, { [id]: nome });
        const saldo = Number(await redis.hget<number | string>(MOEDAS_KEY, id)) || 0;
        revalidatePath('/lupebet');
        return { saldo, nome };
    } catch {
        return { error: 'Non se puido gardar o nome.' };
    }
}

const SEN_APOSTAS: ApostasBoleto = { total: 0, totalSi: 0, totalNon: 0, apostantes: [] };

export async function getApostas(boletoId: string): Promise<ApostasBoleto> {
    noStore();
    if (!boletoId) return SEN_APOSTAS;
    try {
        const raw = await redis.hgetall<Record<string, string | Aposta>>(`${APOSTAS_PREFIX}${boletoId}`);
        if (!raw) return SEN_APOSTAS;

        const apostantes = Object.values(raw)
            .map((v) => {
                try {
                    return (typeof v === 'object' ? v : JSON.parse(v)) as Aposta;
                } catch {
                    return null;
                }
            })
            .filter((a): a is Aposta => Boolean(a && Number.isFinite(a.moedas)))
            .sort((a, b) => b.moedas - a.moedas);

        const suma = (lado: LadoAposta) =>
            apostantes.filter((a) => (a.lado ?? 'si') === lado).reduce((n, a) => n + a.moedas, 0);

        const totalSi = suma('si');
        const totalNon = suma('non');
        return { total: totalSi + totalNon, totalSi, totalNon, apostantes };
    } catch {
        return SEN_APOSTAS;
    }
}

/**
 * Apostar moedas a un boleto. Una apuesta por persona y boleto.
 * El orden importa: primero se reserva el sitio con hsetnx (que es atómico) y
 * solo después se descuenta. Si el saldo no llega, se deshacen las dos cosas.
 */
export async function apostar(
    boletoId: string,
    anonId: string,
    nombre: string,
    moedas: number,
    lado: LadoAposta = 'si',
): Promise<{ saldo?: number; cuota?: number; error?: string }> {
    const id = limpiaAnonId(anonId);
    if (!id) return { error: 'Non se puido identificar o dispositivo.' };

    const cantidad = Math.floor(Number(moedas));
    if (!Number.isFinite(cantidad) || cantidad < 1 || cantidad > MAX_APOSTA) {
        return { error: `A aposta ten que ir entre 1 e ${MAX_APOSTA} moedas.` };
    }

    const ip = clientIpFromHeaders(await headers());
    if (await rateLimited('aposta', ip, 60, 60 * 60)) {
        return { error: 'Demasiadas apostas seguidas. Próbao noutro anaco.' };
    }

    try {
        const boleto = await getBoleto(boletoId);
        if (!boleto) return { error: 'Ese boleto xa non existe.' };
        if (boleto.estado && boleto.estado !== 'aberto') {
            return { error: 'Ese boleto xa está pechado.' };
        }

        // La cuota se calcula AQUÍ, con el dinero que hay ahora mismo en el
        // boleto: la del navegador es solo un adorno y no se acepta a ciegas.
        // Se guarda con la apuesta y ya no se toca, como en las casas de verdad.
        const meu: LadoAposta = lado === 'non' ? 'non' : 'si';
        const antes = await getApostas(boletoId);
        const mercado = mercadoBoleto(boleto.lineas, antes.totalSi, antes.totalNon);

        const key = `${APOSTAS_PREFIX}${boletoId}`;
        const aposta: Aposta = {
            nombre: (nombre || 'Anónimo').trim().slice(0, 24) || 'Anónimo',
            moedas: cantidad,
            ts: Date.now(),
            lado: meu,
            cuota: meu === 'si' ? mercado.si : mercado.non,
        };

        const reservado = await redis.hsetnx(key, id, JSON.stringify(aposta));
        if (!reservado) return { error: 'Xa apostaches neste boleto.' };

        await redis.hsetnx(MOEDAS_KEY, id, SALDO_INICIAL);
        const saldo = await redis.hincrby(MOEDAS_KEY, id, -cantidad);

        if (saldo < 0) {
            await redis.hincrby(MOEDAS_KEY, id, cantidad);
            await redis.hdel(key, id);
            return { error: 'Non tes moedas dabondo.' };
        }

        await redis.hset(MOEDAS_NOME_KEY, { [id]: aposta.nombre });
        await redis.hincrby(APOSTAS_TOTAL_KEY, boletoId, cantidad);
        await redis.hincrby(APOSTAS_N_KEY, boletoId, 1);
        revalidatePath('/lupebet');
        revalidatePath(`/lupebet/${boletoId}`);
        return { saldo, cuota: aposta.cuota };
    } catch {
        return { error: 'Non se puido rexistrar a aposta.' };
    }
}

/**
 * El admin cierra un boleto. Si sale ganado, a cada apostante se le devuelve su
 * apuesta multiplicada por la cuota total (con el tope de MAX_MULTIPLICADOR).
 * El hsetnx del estado es lo que impide pagar dos veces si se pulsa dos veces.
 */
export async function resolverBoleto(
    boletoId: string,
    resultado: 'ganado' | 'perdido',
): Promise<{ success?: true; error?: string }> {
    if (!(await isAdminRequest())) return { error: 'No autorizado' };
    if (resultado !== 'ganado' && resultado !== 'perdido') return { error: 'Resultado non válido' };

    try {
        const boleto = await getBoleto(boletoId);
        if (!boleto) return { error: 'Ese boleto xa non existe.' };

        const primero = await redis.hsetnx(ESTADOS_KEY, boletoId, resultado);
        if (!primero) return { error: 'Ese boleto xa estaba resolto.' };

        // Gana un lado u otro: si el boleto sale, cobran los que fueron a favor;
        // si no sale, cobran los que apostaron en contra. Cada uno cobra a SU
        // cuota, la que congeló al apostar — el que entró antes cobra mejor.
        const ladoGanador: LadoAposta = resultado === 'ganado' ? 'si' : 'non';

        const key = `${APOSTAS_PREFIX}${boletoId}`;
        const raw = await redis.hgetall<Record<string, string | Aposta>>(key);

        for (const [anonId, v] of Object.entries(raw ?? {})) {
            try {
                const a = (typeof v === 'object' ? v : JSON.parse(v)) as Aposta;
                if ((a.lado ?? 'si') !== ladoGanador) continue;
                const pago = Math.round(a.moedas * multiplicadorAposta(a, boleto.lineas));
                if (pago > 0) await redis.hincrby(MOEDAS_KEY, anonId, pago);
            } catch {
                // una apuesta corrupta no debe cortar el pago de las demás
            }
        }

        revalidatePath('/lupebet');
        revalidatePath(`/lupebet/${boletoId}`);
        return { success: true };
    } catch {
        return { error: 'Non se puido pechar o boleto.' };
    }
}

/**
 * El admin destaca un pronóstico: sale arriba del todo en /lupebet, en "Os
 * pronósticos da peña". Va en su propio SET, igual que el estado: destacar no
 * tiene que reescribir la lista entera de boletos.
 */
export async function destacarBoleto(
    boletoId: string,
    destacar: boolean,
): Promise<{ success?: true; error?: string }> {
    if (!(await isAdminRequest())) return { error: 'No autorizado' };
    if (!boletoId) return { error: 'Falta o boleto.' };

    try {
        if (destacar) await redis.sadd(DESTACADOS_KEY, boletoId);
        else await redis.srem(DESTACADOS_KEY, boletoId);

        revalidatePath('/lupebet');
        revalidatePath(`/lupebet/${boletoId}`);
        return { success: true };
    } catch {
        return { error: 'Non se puido destacar o boleto.' };
    }
}

export interface PostoRanking {
    nombre: string;
    saldo: number;
}

/** Clasificación por moedas. Solo sale quien apostó alguna vez (tiene nombre). */
export async function getRankingMoedas(limit = 20): Promise<PostoRanking[]> {
    noStore();
    try {
        const [saldos, nombres] = await Promise.all([
            redis.hgetall<Record<string, string | number>>(MOEDAS_KEY),
            redis.hgetall<Record<string, string>>(MOEDAS_NOME_KEY),
        ]);
        if (!saldos || !nombres) return [];

        return Object.entries(nombres)
            .map(([id, nombre]) => ({ nombre: String(nombre), saldo: Number(saldos[id]) || 0 }))
            .sort((a, b) => b.saldo - a.saldo)
            .slice(0, limit);
    } catch {
        return [];
    }
}

/** Todo lo que el navegador necesita saber de un boleto en una sola llamada. */
export async function getMeuEstado(
    boletoId: string,
    anonId: string,
): Promise<{ saldo: number; aposta: Aposta | null }> {
    noStore();
    const id = limpiaAnonId(anonId);
    if (!id) return { saldo: 0, aposta: null };

    const saldo = await getSaldo(id);
    try {
        const raw = await redis.hget<string | Aposta>(`${APOSTAS_PREFIX}${boletoId}`, id);
        if (!raw) return { saldo, aposta: null };
        const aposta = (typeof raw === 'object' ? raw : JSON.parse(raw)) as Aposta;
        return { saldo, aposta };
    } catch {
        return { saldo, aposta: null };
    }
}
