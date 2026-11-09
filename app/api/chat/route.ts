import { redis } from '@/lib/redis';
import { isAdmin as isAdminSession } from '@/lib/admin-auth';
import { clientIp, rateLimited } from '@/lib/rate-limit';
import { esEmojiValido } from '@/lib/chat-config';
import {
    CHAT_N_KEY,
    PINNED_CHAT_KEY,
    borrarMensaje,
    construirMensaje,
    leerMensajes,
    publicarMensaje,
    reaccionar,
} from '@/lib/chat';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Misma sesión firmada que usan /gestion y los server actions.
const isAdminRequest = isAdminSession;

const unauthorized = () => NextResponse.json({ error: 'No autorizado' }, { status: 401 });

// Topes por IP contra el spam. Holgados a propósito: en la fiesta media peña
// sale por la misma wifi (o el mismo CGNAT del móvil) y comparte IP.
const MAX_MENSAXES_MIN = 40;
const MAX_REACCIONS_MIN = 120;

const slowDown = () => NextResponse.json(
    { error: 'Vas moi rápido. Agarda un minuto.' },
    { status: 429 },
);

async function leerBody(request: Request): Promise<Record<string, unknown>> {
    try {
        const b = await request.json();
        return b && typeof b === 'object' ? b : {};
    } catch {
        return {};
    }
}

export async function GET() {
    try {
        const msgs = await leerMensajes();

        // Get pinned message
        let pinnedMessage = null;
        try {
            const rawPinned = await redis.get(PINNED_CHAT_KEY);
            if (rawPinned) {
                pinnedMessage = typeof rawPinned === 'object' ? rawPinned : JSON.parse(rawPinned as string);
            }
        } catch {
            // silent fail
        }

        return NextResponse.json({ messages: msgs, pinnedMessage }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Surrogate-Control': 'no-store'
            }
        });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await leerBody(request);

        // Never trust the client: the admin flag comes from the cookie, not the body.
        const isAdmin = await isAdminRequest();
        const msg = construirMensaje(body, isAdmin, Date.now(), () => crypto.randomUUID());
        if (!msg) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        if (!isAdmin && await rateLimited('chat', clientIp(request), MAX_MENSAXES_MIN, 60)) {
            return slowDown();
        }

        const updatedMsgs = await publicarMensaje(msg);

        return NextResponse.json({ success: true, messages: updatedMsgs }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
        });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        if (!(await isAdminRequest())) return unauthorized();

        const { id } = await leerBody(request);
        if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        await borrarMensaje(id);
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Error deleting' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const { action, id, emoji, payload } = await leerBody(request);

        if (action === 'pin') {
            if (!(await isAdminRequest())) return unauthorized();
            if (!payload) return NextResponse.json({ error: 'Missing payload for pin' }, { status: 400 });
            await redis.set(PINNED_CHAT_KEY, JSON.stringify(payload));
            await redis.incr(CHAT_N_KEY);
            return NextResponse.json({ success: true });
        }

        if (action === 'unpin') {
            if (!(await isAdminRequest())) return unauthorized();
            await redis.del(PINNED_CHAT_KEY);
            await redis.incr(CHAT_N_KEY);
            return NextResponse.json({ success: true });
        }

        if (action === 'react') {
            // Solo las reacciones de la paleta: antes cualquier texto acababa
            // como clave dentro del mensaje guardado.
            if (typeof id !== 'string' || !id || !esEmojiValido(emoji)) {
                return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });
            }
            if (await rateLimited('chat_react', clientIp(request), MAX_REACCIONS_MIN, 60)) {
                return slowDown();
            }
            await reaccionar(id, emoji);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch {
        return NextResponse.json({ error: 'Error patching' }, { status: 500 });
    }
}
