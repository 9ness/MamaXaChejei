import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Solo el número de cambios del chat, para preguntar barato.
 *
 * Antes el chat se traía la lista entera cada 5 segundos: dos comandos de Redis
 * por vuelta, se hubiera escrito algo o no. Ahora mira este contador (UN
 * comando) y solo se descarga la lista cuando el número cambió — que es lo que
 * pasa la mayor parte del tiempo: nada.
 */
export async function GET() {
    try {
        const n = await redis.get<number | string>('fiesta:chat_n');
        return NextResponse.json(
            { n: Number(n) || 0 },
            { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
        );
    } catch {
        return NextResponse.json({ n: 0 }, { status: 200 });
    }
}
