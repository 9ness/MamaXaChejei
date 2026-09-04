import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { redis } from '@/lib/redis';
import { PIN_REGEX } from '@/lib/admin-pin-config';

export { PIN_LENGTH, PIN_REGEX } from '@/lib/admin-pin-config';

// HASH y no STRING: así no dependemos de si @upstash/redis auto-parsea el JSON.
const PIN_KEY = 'fiesta:admin_pin';

type StoredPin = { salt: string; hash: string };

/**
 * 4 dígitos son 10.000 combinaciones: quien tenga un volcado de Redis lo rompe
 * aunque esté hasheado. El hash solo evita que el PIN se lea a simple vista (y
 * que se filtre si lo reutilizas en otro sitio). La defensa real contra fuerza
 * bruta es el rate limit por IP de app/admin/actions.ts.
 */
function hash(pin: string, salt: string) {
    return scryptSync(pin, salt, 32);
}

async function read(): Promise<StoredPin | null> {
    try {
        const stored = await redis.hgetall<StoredPin>(PIN_KEY);
        if (!stored?.salt || !stored?.hash) return null;
        return { salt: String(stored.salt), hash: String(stored.hash) };
    } catch {
        return null;
    }
}

export async function isPinSet(): Promise<boolean> {
    return (await read()) !== null;
}

export async function setPin(pin: string): Promise<boolean> {
    if (!PIN_REGEX.test(pin)) return false;
    try {
        const salt = randomBytes(16).toString('hex');
        await redis.hset(PIN_KEY, { salt, hash: hash(pin, salt).toString('hex') });
        return true;
    } catch {
        return false;
    }
}

export async function verifyPin(pin: string): Promise<boolean> {
    if (!PIN_REGEX.test(pin)) return false;
    const stored = await read();
    if (!stored) return false;

    const expected = Buffer.from(stored.hash, 'hex');
    const actual = hash(pin, stored.salt);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}
