import { beforeEach, describe, expect, it, vi } from 'vitest';

// Un Redis de juguete en memoria: solo lo que usan rate-limit y admin-auth.
const datos = new Map<string, string>();
const caducidad = new Map<string, number>();
let caido = false;

vi.mock('@/lib/redis', () => {
    const vivo = () => {
        if (caido) throw new Error('Redis caído');
    };
    return {
        redis: {
            incr: async (k: string) => {
                vivo();
                const n = Number(datos.get(k) ?? 0) + 1;
                datos.set(k, String(n));
                return n;
            },
            expire: async (k: string, s: number) => {
                vivo();
                caducidad.set(k, s);
                return 1;
            },
            del: async (k: string) => {
                vivo();
                return datos.delete(k) ? 1 : 0;
            },
            get: async (k: string) => {
                vivo();
                return datos.get(k) ?? null;
            },
            set: async (k: string, v: string, o?: { nx?: boolean }) => {
                vivo();
                if (o?.nx && datos.has(k)) return null;
                datos.set(k, v);
                return 'OK';
            },
        },
    };
});

const galletas = new Map<string, string>();
vi.mock('next/headers', () => ({
    cookies: async () => ({ get: (n: string) => (galletas.has(n) ? { value: galletas.get(n) } : undefined) }),
}));

import { clientIp, rateLimited, resetRateLimit } from '@/lib/rate-limit';

beforeEach(() => {
    datos.clear();
    caducidad.clear();
    galletas.clear();
    caido = false;
});

describe('rateLimited', () => {
    it('deixa pasar ata o máximo e despois bloquea', async () => {
        for (let i = 0; i < 3; i++) expect(await rateLimited('t', '1.2.3.4', 3, 60)).toBe(false);
        expect(await rateLimited('t', '1.2.3.4', 3, 60)).toBe(true);
        // outra IP ou outro balde non se ven afectados
        expect(await rateLimited('t', '5.6.7.8', 3, 60)).toBe(false);
        expect(await rateLimited('outro', '1.2.3.4', 3, 60)).toBe(false);
    });

    it('a xanela ponse só co primeiro intento (ventá fixa)', async () => {
        await rateLimited('t', 'ip', 10, 60);
        caducidad.clear();
        await rateLimited('t', 'ip', 10, 60);
        expect(caducidad.size).toBe(0);
    });

    it('vive dentro de fiesta:rl:', async () => {
        await rateLimited('chat', 'ip', 1, 60);
        expect([...datos.keys()]).toEqual(['fiesta:rl:chat:ip']);
    });

    it('resetRateLimit volve a abrir', async () => {
        await rateLimited('login', 'ip', 1, 60);
        expect(await rateLimited('login', 'ip', 1, 60)).toBe(true);
        await resetRateLimit('login', 'ip');
        expect(await rateLimited('login', 'ip', 1, 60)).toBe(false);
    });

    it('falla en aberto se Redis non responde', async () => {
        caido = true;
        expect(await rateLimited('t', 'ip', 0, 60)).toBe(false);
        await expect(resetRateLimit('t', 'ip')).resolves.toBeUndefined();
    });
});

describe('clientIp', () => {
    const req = (h: Record<string, string>) => new Request('http://x/', { headers: h });
    it('primeira IP de x-forwarded-for, despois x-real-ip', () => {
        expect(clientIp(req({ 'x-forwarded-for': ' 1.1.1.1 , 2.2.2.2' }))).toBe('1.1.1.1');
        expect(clientIp(req({ 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3');
        expect(clientIp(req({}))).toBe('desconocida');
    });
});

describe('admin-auth', () => {
    // El módulo cachea el secreto: uno nuevo por test para no arrastrarlo.
    async function auth() {
        vi.resetModules();
        return import('@/lib/admin-auth');
    }

    it('crea o segredo unha soa vez e firma tokens válidos', async () => {
        const a = await auth();
        const t = await a.createToken('session', 60);
        expect(t).toMatch(/^\d+\.[0-9a-f]{64}$/);
        expect(datos.get('fiesta:admin_secret')).toMatch(/^[0-9a-f]{64}$/);
        expect(await a.verifyToken('session', t!)).toBe(true);
    });

    it('un token de dispositivo non vale como sesión (nin ao revés)', async () => {
        const a = await auth();
        const dev = await a.createToken('device', 60);
        expect(await a.verifyToken('session', dev!)).toBe(false);
        expect(await a.verifyToken('device', dev!)).toBe(true);
    });

    it('rexeita caducados, manipulados e lixo', async () => {
        const a = await auth();
        const t = (await a.createToken('session', 60))!;
        const [exp, sig] = t.split('.');
        expect(await a.verifyToken('session', `${Number(exp) + 1000}.${sig}`)).toBe(false);
        const firmaTocada = sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0');
        expect(await a.verifyToken('session', `${exp}.${firmaTocada}`)).toBe(false);
        expect(await a.verifyToken('session', 'true')).toBe(false); // a vella cookie auth=true
        expect(await a.verifyToken('session', '')).toBe(false);
        expect(await a.verifyToken('session', undefined)).toBe(false);
        expect(await a.verifyToken('session', `abc.${sig}`)).toBe(false);

        const vello = (await a.createToken('session', -10))!;
        expect(await a.verifyToken('session', vello)).toBe(false);
    });

    it('cambiar o segredo invalida todo', async () => {
        const a = await auth();
        const t = (await a.createToken('session', 60))!;
        datos.set('fiesta:admin_secret', 'outro');
        const b = await auth();
        expect(await b.verifyToken('session', t)).toBe(false);
    });

    it('isAdmin le a cookie e falla PECHADO se Redis cae', async () => {
        const a = await auth();
        galletas.set(a.AUTH_COOKIE, (await a.createToken('session', 60))!);
        expect(await a.isAdmin()).toBe(true);
        expect(await a.isTrustedDevice()).toBe(false);

        const b = await auth();
        caido = true;
        expect(await b.isAdmin()).toBe(false);
    });
});
