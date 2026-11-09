import { redis } from '@/lib/redis';
import { CHAT_MAX } from '@/lib/chat-config';

/**
 * Datos del chat en Redis: `fiesta:chat` es una LIST de JSON (LPUSH, el índice
 * 0 es el más nuevo) y `fiesta:chat_n` un contador que sube con cualquier
 * cambio, que es lo que sondea el cliente (`/api/chat/n`).
 *
 * Borrar y reaccionar van en scripts Lua: antes se hacía LRANGE → filtrar →
 * DEL → RPUSH desde el servidor, y un mensaje escrito entre la lectura y la
 * reescritura desaparecía sin dejar rastro (y dos reacciones a la vez se
 * pisaban). Dentro de Redis el script corre de una pieza: nadie se cuela.
 */
export const CHAT_KEY = 'fiesta:chat';
export const PINNED_CHAT_KEY = 'fiesta:chat:pinned';
export const CHAT_N_KEY = 'fiesta:chat_n';

/**
 * Borra el mensaje con ese id. LREM por el valor EXACTO que había en la lista,
 * así no se re-serializa nada. Devuelve 1 si lo encontró, 0 si no.
 */
export const LUA_BORRAR = `
local items = redis.call('LRANGE', KEYS[1], 0, -1)
for _, raw in ipairs(items) do
  local ok, m = pcall(cjson.decode, raw)
  if ok and type(m) == 'table' and m.id == ARGV[1] then
    redis.call('LREM', KEYS[1], 1, raw)
    redis.call('INCR', KEYS[2])
    return 1
  end
end
return 0
`;

/**
 * Suma una reacción al mensaje con ese id, en su sitio (LSET). Devuelve el
 * nuevo número de esa reacción, o 0 si el mensaje ya no está.
 */
export const LUA_REACCIONAR = `
local items = redis.call('LRANGE', KEYS[1], 0, -1)
for i, raw in ipairs(items) do
  local ok, m = pcall(cjson.decode, raw)
  if ok and type(m) == 'table' and m.id == ARGV[1] then
    if type(m.reacciones) ~= 'table' then m.reacciones = {} end
    local n = (tonumber(m.reacciones[ARGV[2]]) or 0) + 1
    m.reacciones[ARGV[2]] = n
    redis.call('LSET', KEYS[1], i - 1, cjson.encode(m))
    redis.call('INCR', KEYS[2])
    return n
  end
end
return 0
`;

export interface ChatMessage {
    id: string;
    nombre: string;
    mensaje: string;
    fecha: number;
    reacciones?: Record<string, number>;
    isPinned?: boolean;
    isAdminMessage?: boolean;
    respondeA?: { id: string; nombre: string; mensaje: string };
}

/** `@upstash/redis` a veces ya devuelve el objeto parseado y a veces el string. */
export function parseMensajes(raw: unknown[]): ChatMessage[] {
    const out: ChatMessage[] = [];
    for (const s of raw) {
        try {
            const m = typeof s === 'object' ? s : JSON.parse(String(s));
            if (m && typeof m === 'object') out.push(m as ChatMessage);
        } catch {
            // un mensaje roto no tumba la lista
        }
    }
    return out;
}

/**
 * Construye el mensaje que se guarda, con todo truncado. Nunca se fía del
 * cliente: el "(Admin)" lo decide quien llama, con la cookie.
 */
export function construirMensaje(
    body: { nombre?: unknown; mensaje?: unknown; id?: unknown; respondeA?: unknown },
    isAdmin: boolean,
    ahora: number,
    nuevoId: () => string,
): ChatMessage | null {
    // Sin trim: el cliente reconoce sus mensajes comparando el nombre exacto.
    const nombre = typeof body.nombre === 'string' ? body.nombre : '';
    const mensaje = typeof body.mensaje === 'string' ? body.mensaje.slice(0, 500) : '';
    if (!nombre.trim() || !mensaje.trim()) return null;

    // La respuesta guarda una COPIA del mensaje original (nombre + un trozo
    // del texto). Si luego lo borran, la cita sigue teniendo sentido y no
    // hay que ir a buscarlo a la lista.
    const r = body.respondeA;
    const cita = r && typeof r === 'object'
        ? {
            id: String((r as Record<string, unknown>).id ?? '').slice(0, 64),
            nombre: String((r as Record<string, unknown>).nombre ?? '').slice(0, 40),
            mensaje: String((r as Record<string, unknown>).mensaje ?? '').slice(0, 120),
        }
        : null;

    // El id lo pone el cliente para casar el mensaje optimista con el real.
    const id = typeof body.id === 'string' && body.id.trim()
        ? body.id.trim().slice(0, 64)
        : nuevoId();

    return {
        id,
        nombre: (isAdmin ? `${nombre} (Admin)` : nombre).slice(0, 40),
        mensaje,
        fecha: ahora,
        reacciones: {},
        isPinned: false,
        isAdminMessage: isAdmin,
        ...(cita && cita.id ? { respondeA: cita } : {}),
    };
}

/** Lee los últimos mensajes (el índice 0 es el más nuevo). */
export async function leerMensajes(): Promise<ChatMessage[]> {
    return parseMensajes(await redis.lrange(CHAT_KEY, 0, CHAT_MAX - 1));
}

/**
 * Publica y devuelve la lista ya actualizada, en UNA transacción: antes eran
 * cuatro viajes a Upstash (LPUSH, LTRIM, INCR, LRANGE) por mensaje.
 */
export async function publicarMensaje(msg: ChatMessage): Promise<ChatMessage[]> {
    const [, , , lista] = await redis
        .multi()
        .lpush(CHAT_KEY, JSON.stringify(msg))
        .ltrim(CHAT_KEY, 0, CHAT_MAX - 1)
        .incr(CHAT_N_KEY)
        .lrange(CHAT_KEY, 0, CHAT_MAX - 1)
        .exec<[number, string, number, unknown[]]>();
    return parseMensajes(lista ?? []);
}

/** Borra el mensaje y, si era el fijado, también la chincheta. */
export async function borrarMensaje(id: string): Promise<boolean> {
    const n = await redis.eval<[string], number>(LUA_BORRAR, [CHAT_KEY, CHAT_N_KEY], [id]);

    const pinnedRaw = await redis.get(PINNED_CHAT_KEY);
    if (pinnedRaw) {
        try {
            const pinned = typeof pinnedRaw === 'object' ? pinnedRaw : JSON.parse(String(pinnedRaw));
            if ((pinned as { id?: string })?.id === id) await redis.del(PINNED_CHAT_KEY);
        } catch {
            // chincheta ilegible: se queda como está
        }
    }
    return Number(n) > 0;
}

/** Suma la reacción. Devuelve el nuevo total de ese emoji, o 0 si el mensaje ya no está. */
export async function reaccionar(id: string, emoji: string): Promise<number> {
    const n = await redis.eval<[string, string], number>(LUA_REACCIONAR, [CHAT_KEY, CHAT_N_KEY], [id, emoji]);
    return Number(n) || 0;
}
