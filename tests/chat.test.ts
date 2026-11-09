import { describe, expect, it, vi } from 'vitest';

// lib/chat importa el cliente de Redis; aquí solo se prueba la parte pura.
vi.mock('@/lib/redis', () => ({ redis: {} }));

import { construirMensaje, parseMensajes } from '@/lib/chat';
import { REACTION_EMOJIS, esEmojiValido } from '@/lib/chat-config';

const nuevoId = () => 'generado';

describe('construirMensaje', () => {
    it('arma el mensaje con lo justo', () => {
        const m = construirMensaje({ nombre: 'Pepe', mensaje: 'Ola!', id: 'abc' }, false, 123, nuevoId);
        expect(m).toEqual({
            id: 'abc',
            nombre: 'Pepe',
            mensaje: 'Ola!',
            fecha: 123,
            reacciones: {},
            isPinned: false,
            isAdminMessage: false,
        });
    });

    it('rechaza nombre o mensaje vacíos o que no son texto', () => {
        expect(construirMensaje({ nombre: '  ', mensaje: 'x' }, false, 1, nuevoId)).toBeNull();
        expect(construirMensaje({ nombre: 'a', mensaje: '   ' }, false, 1, nuevoId)).toBeNull();
        expect(construirMensaje({ nombre: 42, mensaje: 'x' }, false, 1, nuevoId)).toBeNull();
        expect(construirMensaje({ nombre: 'a', mensaje: { $ne: 1 } }, false, 1, nuevoId)).toBeNull();
        expect(construirMensaje({}, false, 1, nuevoId)).toBeNull();
    });

    it('el (Admin) lo pone quien llama, no el cliente', () => {
        const m = construirMensaje({ nombre: 'Nés', mensaje: 'x', isAdmin: true } as never, false, 1, nuevoId);
        expect(m?.isAdminMessage).toBe(false);
        expect(m?.nombre).toBe('Nés');

        const a = construirMensaje({ nombre: 'Nés', mensaje: 'x' }, true, 1, nuevoId);
        expect(a?.nombre).toBe('Nés (Admin)');
        expect(a?.isAdminMessage).toBe(true);
    });

    it('trunca todo', () => {
        const m = construirMensaje({
            nombre: 'n'.repeat(100),
            mensaje: 'm'.repeat(900),
            id: 'i'.repeat(100),
            respondeA: { id: 'r'.repeat(100), nombre: 'q'.repeat(100), mensaje: 'z'.repeat(500) },
        }, false, 1, nuevoId)!;
        expect(m.nombre).toHaveLength(40);
        expect(m.mensaje).toHaveLength(500);
        expect(m.id).toHaveLength(64);
        expect(m.respondeA).toEqual({ id: 'r'.repeat(64), nombre: 'q'.repeat(40), mensaje: 'z'.repeat(120) });
    });

    it('NO recorta espacios del nombre: el cliente casa sus mensajes por el nombre exacto', () => {
        expect(construirMensaje({ nombre: ' Pepe ', mensaje: 'x' }, false, 1, nuevoId)?.nombre).toBe(' Pepe ');
    });

    it('sin id del cliente, genera uno', () => {
        expect(construirMensaje({ nombre: 'a', mensaje: 'b' }, false, 1, nuevoId)?.id).toBe('generado');
        expect(construirMensaje({ nombre: 'a', mensaje: 'b', id: '   ' }, false, 1, nuevoId)?.id).toBe('generado');
        expect(construirMensaje({ nombre: 'a', mensaje: 'b', id: 7 }, false, 1, nuevoId)?.id).toBe('generado');
    });

    it('una cita sin id no se guarda', () => {
        const m = construirMensaje({ nombre: 'a', mensaje: 'b', respondeA: { nombre: 'x' } }, false, 1, nuevoId);
        expect(m).not.toHaveProperty('respondeA');
        const n = construirMensaje({ nombre: 'a', mensaje: 'b', respondeA: 'texto' }, false, 1, nuevoId);
        expect(n).not.toHaveProperty('respondeA');
    });
});

describe('parseMensajes', () => {
    it('acepta objetos ya parseados y strings, y se salta los rotos', () => {
        const out = parseMensajes([
            { id: '1', nombre: 'a', mensaje: 'x', fecha: 1 },
            JSON.stringify({ id: '2', nombre: 'b', mensaje: 'y', fecha: 2 }),
            '{roto',
            'null',
            '42',
        ]);
        expect(out.map((m) => m.id)).toEqual(['1', '2']);
    });
});

describe('esEmojiValido', () => {
    it('solo la paleta cerrada', () => {
        for (const e of REACTION_EMOJIS) expect(esEmojiValido(e)).toBe(true);
        expect(esEmojiValido('🤡')).toBe(false);
        expect(esEmojiValido('<img src=x onerror=alert(1)>')).toBe(false);
        expect(esEmojiValido(undefined)).toBe(false);
        expect(esEmojiValido(['🔥'])).toBe(false);
    });
});
