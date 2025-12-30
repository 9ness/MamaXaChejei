import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CHAT_KEY = 'fiesta:chat';
const PINNED_CHAT_KEY = 'fiesta:chat:pinned';

export async function GET() {
    try {
        const rawMsgs = await redis.lrange(CHAT_KEY, 0, 49);
        const msgs = rawMsgs.map((s: string | object) => {
            try {
                if (typeof s === 'object') return s;
                return JSON.parse(s);
            } catch { return null; }
        }).filter(Boolean);

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
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { nombre, mensaje, id, isAdmin } = body;

        if (!nombre || !mensaje) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        // Apply visual distinction for admin
        const finalNombre = isAdmin ? `${nombre} (Admin)` : nombre;

        const msg = {
            id: id || crypto.randomUUID(),
            nombre: finalNombre.slice(0, 40),
            mensaje: String(mensaje).slice(0, 500),
            fecha: Date.now(),
            reacciones: {},
            isPinned: false,
            isAdminMessage: !!isAdmin
        };

        await redis.lpush(CHAT_KEY, JSON.stringify(msg));
        await redis.ltrim(CHAT_KEY, 0, 49);

        // Fetch updated list
        const rawMsgs = await redis.lrange(CHAT_KEY, 0, 49);
        const updatedMsgs = rawMsgs.map((s: string | object) => {
            try {
                if (typeof s === 'object') return s;
                return JSON.parse(s);
            } catch { return null; }
        }).filter(Boolean);

        return NextResponse.json({ success: true, messages: updatedMsgs }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
        });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { id } = await request.json();
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        // Get all messages, filter out the one to delete, rewrite list
        // Redis LREM removes by value, but value is JSON string which might vary slightly?
        // Safer to read all, filter, delete key, rpush all back.
        // For atomic safety usually we use Lua, but for this scale read/write is okay.

        const rawMsgs = await redis.lrange(CHAT_KEY, 0, 99);
        const msgs = rawMsgs.map((s: string | object) => {
            try { return typeof s === 'object' ? s : JSON.parse(s); } catch { return null; }
        }).filter((m: any) => m && m.id !== id);

        // Rewrite list
        await redis.del(CHAT_KEY);
        if (msgs.length > 0) {
            // RPUSH preserves order if we push in reverse? No, lrange is 0..N (newest first usually if we lpush)
            // If we LPUSH'd, 0 is newest.
            // So if msgs is [newest, ..., oldest]
            // We should RPUSH them in reverse order?
            // Or just RPUSH [newest, ..., oldest] makes Newest at Index 0? No.
            // If we RPUSH [A, B], list is A, B. Index 0 is A.
            // If our list was [Newest, Oldest].
            // We want Index 0 to be Newest.
            // So we want result List: [Newest, ..., Oldest]
            // redis.rpush(key, ...msgs) -> List becomes [msg1, msg2...]
            // So yes, RPUSH the array as-is? 
            // Wait. redis.lrange(0, -1) returns [Item0, Item1...]
            // If Item0 is Newest.
            // We want Item0 to stay Newest.
            // redis.del -> List empty.
            // redis.rpush(key, Item0, Item1...) -> List: Item0, Item1...
            // Yes.

            // Need to stringify
            const stringified = msgs.map(m => JSON.stringify(m));
            await redis.rpush(CHAT_KEY, ...stringified);
        }

        // Also check if it was pinned
        const pinnedRaw = await redis.get(PINNED_CHAT_KEY);
        if (pinnedRaw) {
            const pinned = typeof pinnedRaw === 'object' ? pinnedRaw : JSON.parse(pinnedRaw as string);
            if (pinned.id === id) {
                await redis.del(PINNED_CHAT_KEY);
            }
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Error deleting' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { action, id, emoji, payload } = body;

        if (action === 'pin') {
            if (!payload) return NextResponse.json({ error: 'Missing payload for pin' }, { status: 400 });
            await redis.set(PINNED_CHAT_KEY, JSON.stringify(payload));
            return NextResponse.json({ success: true });
        }

        if (action === 'unpin') {
            await redis.del(PINNED_CHAT_KEY);
            return NextResponse.json({ success: true });
        }

        if (action === 'react') {
            // Complicated: Read list, find message, update reaction, rewrite list.
            const rawMsgs = await redis.lrange(CHAT_KEY, 0, 99);
            let found = false;
            const msgs = rawMsgs.map((s: string | object) => {
                try {
                    const m = typeof s === 'object' ? s : JSON.parse(s);
                    if (m && m.id === id) {
                        found = true;
                        m.reacciones = m.reacciones || {};
                        m.reacciones[emoji] = (m.reacciones[emoji] || 0) + 1;
                    }
                    return m;
                } catch { return null; }
            }).filter(Boolean);

            if (found) {
                await redis.del(CHAT_KEY);
                if (msgs.length > 0) {
                    const stringified = msgs.map((m: any) => JSON.stringify(m));
                    await redis.rpush(CHAT_KEY, ...stringified);
                }
            }
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch {
        return NextResponse.json({ error: 'Error patching' }, { status: 500 });
    }
}
