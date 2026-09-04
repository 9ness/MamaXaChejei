import { redis } from '@/lib/redis';

/**
 * Rate limit de ventana fija. Devuelve true si hay que RECHAZAR.
 * Falla en abierto: si Redis no responde, no bloqueamos al invitado
 * (mismo criterio defensivo que el resto de la app).
 */
export async function rateLimited(bucket: string, id: string, max: number, windowS: number) {
    try {
        const key = `fiesta:rl:${bucket}:${id}`;
        const n = await redis.incr(key);
        if (n === 1) await redis.expire(key, windowS);
        return n > max;
    } catch {
        return false;
    }
}

/** Borra el contador. Úsalo al acertar, para no autobloquear a quien sí sabe la clave. */
export async function resetRateLimit(bucket: string, id: string) {
    try {
        await redis.del(`fiesta:rl:${bucket}:${id}`);
    } catch {
        // da igual: el contador caduca solo
    }
}

/** IP del cliente. En Vercel la cabecera la pone su proxy; en local es falsificable. */
export function clientIpFromHeaders(h: Headers) {
    const fwd = h.get('x-forwarded-for');
    return fwd?.split(',')[0]?.trim() || h.get('x-real-ip') || 'desconocida';
}

export function clientIp(request: Request) {
    return clientIpFromHeaders(request.headers);
}
