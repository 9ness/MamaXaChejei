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

/** IP del cliente. En Vercel la cabecera la pone su proxy; en local es falsificable. */
export function clientIp(request: Request) {
    const fwd = request.headers.get('x-forwarded-for');
    return fwd?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'desconocida';
}
