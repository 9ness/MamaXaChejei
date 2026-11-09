import { execFile, execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/redis', () => ({ redis: {} }));

import { LUA_BORRAR, LUA_REACCIONAR } from '@/lib/chat';

/**
 * Los scripts Lua del chat contra un Redis DE VERDAD: un redis-server efímero
 * en un puerto al azar, sin disco, que se apaga al acabar. Nunca toca Upstash.
 * Upstash corre el mismo Lua 5.1 + cjson que Redis, así que esto prueba lo
 * delicado: que cjson no estropee la fecha, los emojis ni el `{}` vacío.
 * Sin `redis-server` instalado, el bloque se salta.
 */
function hayRedis() {
    try {
        execFileSync('redis-server', ['--version'], { stdio: 'ignore' });
        execFileSync('redis-cli', ['--version'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

const PUERTO = String(20000 + Math.floor(Math.random() * 30000));
const LISTA = 'test:chat';
const CONTADOR = 'test:chat_n';
let servidor: ChildProcess | undefined;
let dir = '';

function cli(...args: string[]): string {
    return execFileSync('redis-cli', ['-p', PUERTO, ...args], { encoding: 'utf8' }).replace(/\n$/, '');
}
const lista = () => cli('LRANGE', LISTA, '0', '-1').split('\n').filter(Boolean).map((s) => JSON.parse(s));
const borrar = (id: string) => Number(cli('EVAL', LUA_BORRAR, '2', LISTA, CONTADOR, id));
const reaccionar = (id: string, emoji: string) => Number(cli('EVAL', LUA_REACCIONAR, '2', LISTA, CONTADOR, id, emoji));

function mensaje(id: string, extra: Record<string, unknown> = {}) {
    return {
        id,
        nombre: `Pepe ${id}`,
        mensaje: 'Ola «peña» 🍻 "comiñas" / barras \\ e\nliñas',
        fecha: 1794254899123,
        reacciones: {},
        isPinned: false,
        isAdminMessage: false,
        ...extra,
    };
}

describe.skipIf(!hayRedis())('Lua do chat contra redis-server', () => {
    beforeAll(async () => {
        dir = mkdtempSync(join(tmpdir(), 'mxc-redis-'));
        servidor = spawn('redis-server', ['--port', PUERTO, '--save', '', '--appendonly', 'no', '--dir', dir, '--bind', '127.0.0.1'], { stdio: 'ignore' });
        for (let i = 0; i < 50; i++) {
            try {
                if (cli('PING') === 'PONG') return;
            } catch {
                // aún arrancando
            }
            await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error('redis-server non arrancou');
    });

    afterAll(() => {
        servidor?.kill();
        if (dir) rmSync(dir, { recursive: true, force: true });
    });

    beforeEach(() => {
        cli('FLUSHALL');
        // LPUSH como publicarMensaje: o índice 0 é o máis novo
        for (const id of ['a', 'b', 'c']) cli('LPUSH', LISTA, JSON.stringify(mensaje(id)));
    });

    it('reaccionar suma no seu sitio e conserva todo o demais', () => {
        expect(reaccionar('b', '🔥')).toBe(1);
        expect(reaccionar('b', '🔥')).toBe(2);
        expect(reaccionar('b', '😂')).toBe(1);

        const [c, b, a] = lista();
        expect(b).toEqual({ ...mensaje('b'), reacciones: { '🔥': 2, '😂': 1 } });
        // a fecha de 13 cifras sobrevive a cjson (%.14g)
        expect(b.fecha).toBe(1794254899123);
        // os outros, intactos e na mesma orde
        expect(a).toEqual(mensaje('a'));
        expect(c).toEqual(mensaje('c'));
        expect(cli('GET', CONTADOR)).toBe('3');
    });

    it('un mensaxe sen reaccións segue gardando {} e non []', () => {
        reaccionar('a', '❤️');
        const raw = cli('LRANGE', LISTA, '0', '-1');
        expect(raw).toContain('"reacciones":{}');
        expect(raw).not.toContain('"reacciones":[]');
    });

    it('mensaxes vellos sen campo reacciones', () => {
        cli('LPUSH', LISTA, JSON.stringify({ id: 'vello', nombre: 'x', mensaje: 'y', fecha: 1 }));
        expect(reaccionar('vello', '🥳')).toBe(1);
        expect(lista()[0]).toEqual({ id: 'vello', nombre: 'x', mensaje: 'y', fecha: 1, reacciones: { '🥳': 1 } });
    });

    it('a cita (respondeA) e os booleanos pasan tal cal', () => {
        const cita = { id: 'a', nombre: 'Pepe a', mensaje: 'trozo 😂' };
        cli('LPUSH', LISTA, JSON.stringify(mensaje('r', { respondeA: cita, isAdminMessage: true })));
        reaccionar('r', '💩');
        expect(lista()[0]).toEqual(mensaje('r', { respondeA: cita, isAdminMessage: true, reacciones: { '💩': 1 } }));
    });

    it('borrar quita só ese e conta o cambio', () => {
        expect(borrar('b')).toBe(1);
        expect(lista().map((m) => m.id)).toEqual(['c', 'a']);
        expect(cli('GET', CONTADOR)).toBe('1');
    });

    it('un id que xa non está: 0 e sen tocar nada', () => {
        expect(borrar('non-existe')).toBe(0);
        expect(reaccionar('non-existe', '🔥')).toBe(0);
        expect(lista()).toHaveLength(3);
        expect(cli('EXISTS', CONTADOR)).toBe('0');
    });

    it('un elemento roto na lista non tumba os scripts', () => {
        cli('LPUSH', LISTA, '{roto');
        cli('LPUSH', LISTA, '"texto"');
        expect(reaccionar('a', '🔥')).toBe(1);
        expect(borrar('c')).toBe(1);
        expect(cli('LLEN', LISTA)).toBe('4');
    });

    it('o que antes se perdía: un mensaxe novo entre reaccións segue aí', () => {
        // Antes: LRANGE → (chega un LPUSH) → DEL → RPUSH, e o novo desaparecía.
        // Agora cada script é atómico; intercálanse escrituras e non se perde ningunha.
        for (let i = 0; i < 20; i++) {
            cli('LPUSH', LISTA, JSON.stringify(mensaje(`n${i}`)));
            reaccionar('a', '🍻');
            if (i % 5 === 0) borrar(`n${i}`);
        }
        const ids = lista().map((m) => m.id);
        expect(ids).toHaveLength(3 + 20 - 4);
        expect(ids).toContain('n19');
        expect(lista().find((m) => m.id === 'a')?.reacciones).toEqual({ '🍻': 20 });
    });

    it('en paralelo de verdade: 30 publicacións e 30 reaccións á vez, ningunha perdida', async () => {
        const run = promisify(execFile);
        const r = (...args: string[]) => run('redis-cli', ['-p', PUERTO, ...args]);
        await Promise.all(Array.from({ length: 30 }, (_, i) => [
            r('LPUSH', LISTA, JSON.stringify(mensaje(`p${i}`))),
            r('EVAL', LUA_REACCIONAR, '2', LISTA, CONTADOR, 'b', '🔥'),
        ]).flat());
        const msgs = lista();
        expect(msgs).toHaveLength(33);
        expect(msgs.find((m) => m.id === 'b')?.reacciones).toEqual({ '🔥': 30 });
        expect(cli('GET', CONTADOR)).toBe('30');
    });
});
