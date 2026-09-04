'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
    AUTH_COOKIE,
    DEVICE_COOKIE,
    DEVICE_MAX_AGE,
    SESSION_MAX_AGE,
    createToken,
    isAdmin,
    isTrustedDevice,
} from '@/lib/admin-auth';
import { PIN_REGEX, isPinSet, setPin, verifyPin } from '@/lib/admin-pin';
import { clientIpFromHeaders, rateLimited, resetRateLimit } from '@/lib/rate-limit';

// 10 intentos por IP cada 15 min. Con un PIN de 4 dígitos esto ES la seguridad:
// sin límite, 10.000 combinaciones se prueban en minutos. Ojo al calibrarlo:
// en el wifi de la fiesta todos comparten IP, pero al acertar se resetea.
const MAX_TRIES = 10;
const TRY_WINDOW_S = 60 * 15;

type Result = { success?: true; error?: string };

async function setCookieToken(name: string, scope: 'session' | 'device', maxAge: number) {
    const token = await createToken(scope, maxAge);
    if (!token) return false;

    (await cookies()).set(name, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge,
        path: '/',
    });
    return true;
}

/** Enciende el modo admin. */
const startSession = () => setCookieToken(AUTH_COOKIE, 'session', SESSION_MAX_AGE);

/** Marca este móvil como de confianza: a partir de ahora el gesto es un interruptor. */
const trustDevice = () => setCookieToken(DEVICE_COOKIE, 'device', DEVICE_MAX_AGE);

async function tooManyTries() {
    const ip = clientIpFromHeaders(await headers());
    return { ip, blocked: await rateLimited('admin_login', ip, MAX_TRIES, TRY_WINDOW_S) };
}

/**
 * Comprueba el secreto de entrada. Mientras no haya PIN guardado en Redis vale
 * el ADMIN_PASSWORD de siempre — respaldo para quien ya lo tenía configurado.
 */
async function checkSecret(secret: string) {
    if (await isPinSet()) return verifyPin(secret);
    return Boolean(process.env.ADMIN_PASSWORD) && secret === process.env.ADMIN_PASSWORD;
}

/** ¿Hay ya un PIN en Redis? Decide si el teclado pide el PIN o pide crearlo. */
export async function isPinConfigured(): Promise<boolean> {
    return isPinSet();
}

/**
 * Primera vez: se elige el PIN desde la propia app y se guarda en Redis. Solo
 * funciona MIENTRAS NO EXISTA PIN — después, cambiarlo exige estar dentro
 * (`changePin`). Carrera asumida: dos móviles poniéndolo en el mismo segundo,
 * gana el último; no compensa un Lua para esto.
 */
export async function setupPin(pin: string): Promise<Result> {
    const { ip, blocked } = await tooManyTries();
    if (blocked) return { error: 'Demasiados intentos. Espera 15 minutos.' };

    if (!PIN_REGEX.test(pin)) return { error: 'El PIN tiene que ser de 4 dígitos' };
    if (await isPinSet()) return { error: 'Ya hay un PIN puesto en esta app' };
    if (!(await setPin(pin))) return { error: 'No se pudo guardar el PIN' };

    await resetRateLimit('admin_login', ip);
    if (!(await startSession())) return { error: 'No se pudo iniciar sesión. Inténtalo otra vez.' };
    await trustDevice();
    return { success: true };
}

/** Entrada por PIN (teclado oculto). No redirige: el cliente navega al acertar. */
export async function loginWithPin(pin: string): Promise<Result> {
    const { ip, blocked } = await tooManyTries();
    if (blocked) return { error: 'Demasiados intentos. Espera 15 minutos.' };

    if (!PIN_REGEX.test(pin) || !(await checkSecret(pin))) return { error: 'PIN incorrecto' };

    await resetRateLimit('admin_login', ip);
    if (!(await startSession())) return { error: 'No se pudo iniciar sesión. Inténtalo otra vez.' };
    await trustDevice();
    return { success: true };
}

/** Interruptor: encender el modo admin en un móvil ya autorizado, sin PIN. */
export async function enableAdminMode(): Promise<Result> {
    if (!(await isTrustedDevice())) return { error: 'Este dispositivo no está autorizado' };
    if (!(await startSession())) return { error: 'No se pudo activar el modo admin' };
    return { success: true };
}

/** Interruptor: volver a modo normal. El móvil sigue autorizado. */
export async function disableAdminMode(): Promise<Result> {
    (await cookies()).delete(AUTH_COOKIE);
    return { success: true };
}

/** Entrada por contraseña larga (respaldo de /gestion si se olvida el PIN). */
export async function login(formData: FormData) {
    const password = formData.get('password');
    const { ip, blocked } = await tooManyTries();
    if (blocked) return { error: 'Demasiados intentos. Espera 15 minutos.' };

    if (typeof password !== 'string' || !(await checkSecret(password))) {
        return { error: 'Contraseña incorrecta' };
    }

    await resetRateLimit('admin_login', ip);
    if (!(await startSession())) return { error: 'No se pudo iniciar sesión. Inténtalo otra vez.' };
    await trustDevice();
    redirect('/gestion');
}

/** Cambiar el PIN desde /gestion. Pide el secreto actual aunque ya estés dentro. */
export async function changePin(currentSecret: string, newPin: string): Promise<Result> {
    if (!(await isAdmin())) return { error: 'No autorizado' };
    if (!PIN_REGEX.test(newPin)) return { error: 'El PIN nuevo tiene que ser de 4 dígitos' };

    const hadPin = await isPinSet();
    if (typeof currentSecret !== 'string' || !(await checkSecret(currentSecret))) {
        return { error: hadPin ? 'El PIN actual no es correcto' : 'La contraseña actual no es correcta' };
    }

    if (!(await setPin(newPin))) return { error: 'No se pudo guardar el PIN' };
    return { success: true };
}

/** "Salir" de verdad: apaga el modo admin Y desautoriza este dispositivo. */
export async function logout() {
    const jar = await cookies();
    jar.delete(AUTH_COOKIE);
    jar.delete(DEVICE_COOKIE);
    redirect('/');
}
