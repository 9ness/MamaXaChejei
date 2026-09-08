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

export interface Foto {
    url: string;
    ts: number;
}

export async function addFoto(url: string) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        return { success: false };
    }
    try {
        const foto: Foto = { url: url.slice(0, 500), ts: Date.now() };
        await redis.lpush(FOTOS_KEY, JSON.stringify(foto));
        await redis.ltrim(FOTOS_KEY, 0, 299); // conserva las últimas 300
        revalidatePath('/recuerdos');
        return { success: true };
    } catch {
        return { success: false };
    }
}

export async function getFotos(): Promise<Foto[]> {
    noStore();
    try {
        const raw = await redis.lrange(FOTOS_KEY, 0, 299);
        return raw
            .map((s: string | object) => {
                try {
                    return typeof s === 'object' ? (s as Foto) : (JSON.parse(s) as Foto);
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
const LOC_INDEX = `${NAMESPACE}:loc_ids`;

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
        await redis.sadd(LOC_INDEX, id);
        return { success: true };
    } catch {
        return { success: false };
    }
}

export async function removeLocation(anonId: string) {
    try {
        const id = anonId.slice(0, 40);
        await redis.del(`${LOC_PREFIX}${id}`);
        await redis.srem(LOC_INDEX, id);
        return { success: true };
    } catch {
        return { success: false };
    }
}

/** Devuelve coordenadas + nombre/color opcionales. Sin IDs (no se sabe qué punto es de quién salvo por el nombre que cada uno elija poner). */
export async function getLocations(): Promise<MapPoint[]> {
    noStore();
    try {
        const ids = (await redis.smembers(LOC_INDEX)) as string[];
        if (!ids || ids.length === 0) return [];

        const pipeline = redis.pipeline();
        ids.forEach(id => pipeline.get(`${LOC_PREFIX}${id}`));
        const results = await pipeline.exec<(AnonLocation | string | null)[]>();

        const points: MapPoint[] = [];
        const expired: string[] = [];

        results.forEach((raw, i) => {
            if (raw == null) {
                expired.push(ids[i]); // caducado → limpiar del índice
                return;
            }
            const loc = typeof raw === 'string' ? (JSON.parse(raw) as AnonLocation) : (raw as AnonLocation);
            if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
                points.push({ lat: loc.lat, lng: loc.lng, ts: loc.ts, name: loc.name, color: loc.color, live: loc.live });
            }
        });

        if (expired.length > 0) {
            await redis.srem(LOC_INDEX, ...expired);
        }

        return points;
    } catch {
        return [];
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
