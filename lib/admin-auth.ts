import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { redis } from '@/lib/redis';

/** Modo admin activo AHORA (el interruptor de los 5 toques). */
export const AUTH_COOKIE = 'auth';
/** Este móvil ya demostró saber el PIN: puede encender el modo admin sin volver a marcarlo. */
export const DEVICE_COOKIE = 'admin_device';

const SECRET_KEY = 'fiesta:admin_secret';

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;        // 7 días
export const DEVICE_MAX_AGE = 60 * 60 * 24 * 365;       // 1 año

type Scope = 'session' | 'device';

let cachedSecret: string | null = null;

/**
 * Secreto con el que se firman las cookies. Vive en Redis (no en env) para que
 * sobreviva a los despliegues sin tener que tocar Vercel. Se crea solo la
 * primera vez, con SET NX para que dos lambdas arrancando a la vez no se pisen
 * (si se pisaran, se invalidarían las sesiones de la otra).
 */
async function getSessionSecret(): Promise<string | null> {
    if (cachedSecret) return cachedSecret;
    try {
        const existing = await redis.get<string>(SECRET_KEY);
        if (existing) {
            cachedSecret = String(existing);
            return cachedSecret;
        }
        await redis.set(SECRET_KEY, randomBytes(32).toString('hex'), { nx: true });
        const created = await redis.get<string>(SECRET_KEY);
        if (!created) return null;
        cachedSecret = String(created);
        return cachedSecret;
    } catch {
        return null;
    }
}

// El scope entra en la firma para que un token de dispositivo no se pueda
// colar como token de sesión (ni al revés) copiando el valor de una cookie.
function sign(scope: Scope, exp: string, secret: string) {
    return createHmac('sha256', secret).update(`${scope}.${exp}`).digest('hex');
}

/** Token: `<caducidad>.<firma>`. Sin firma válida no hay nada. */
export async function createToken(scope: Scope, maxAgeS: number): Promise<string | null> {
    const secret = await getSessionSecret();
    if (!secret) return null;
    const exp = String(Date.now() + maxAgeS * 1000);
    return `${exp}.${sign(scope, exp, secret)}`;
}

export async function verifyToken(scope: Scope, token?: string): Promise<boolean> {
    if (!token) return false;
    const [exp, sig] = token.split('.');
    if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;

    const secret = await getSessionSecret();
    if (!secret) return false;

    const expected = Buffer.from(sign(scope, exp, secret), 'hex');
    const actual = Buffer.from(sig, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Única fuente de verdad de "soy admin". Ojo: al revés que el resto de la app,
 * esto falla CERRADO — si Redis no responde no hay admin, que es lo correcto
 * para una comprobación de auth.
 */
export async function isAdmin(): Promise<boolean> {
    return verifyToken('session', (await cookies()).get(AUTH_COOKIE)?.value);
}

/**
 * ¿Este dispositivo puede encender el modo admin sin marcar el PIN? Es un token
 * al portador: quien tenga el móvil desbloqueado entra. Se revoca borrando
 * `fiesta:admin_secret` (echa a todos) o con el botón "Salir" (solo a este).
 */
export async function isTrustedDevice(): Promise<boolean> {
    return verifyToken('device', (await cookies()).get(DEVICE_COOKIE)?.value);
}
