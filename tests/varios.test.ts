import { describe, expect, it } from 'vitest';
import { fotoId } from '@/lib/fotos';
import { EMOJIS_LUGAR, LUGARES_BASE, basePorId, buscarLugar, emojiValido, lugaresColocados, mapaUrl, mapsUrl } from '@/lib/lugares';
import { DEFAULT_PENA_COLOR, PENA_PRESETS, esPenaColor, getPenaPreset, penaColorStyle } from '@/lib/pena-colors';
import { ITINERARIO } from '@/lib/itinerario';
import { PIN_REGEX } from '@/lib/admin-pin-config';

describe('fotoId', () => {
    it('o nome do ficheiro en Blob, sen query', () => {
        expect(fotoId('https://x.public.blob.vercel-storage.com/fotos/abc-123_X.webp?download=1')).toBe('abc-123_X.webp');
    });
    it('nada raro pasa como id', () => {
        expect(fotoId('')).toBe('');
        expect(fotoId('https://x/fotos/')).toBe('');
        expect(fotoId('https://x/fotos/<script>.png')).toBe('');
        expect(fotoId(undefined as unknown as string)).toBe('');
    });
});

describe('lugares', () => {
    const gardados = { 'praza-castelao': { lat: 42.65, lng: -8.81, emoji: '🍻' } };

    it('a paleta de iconas é pechada', () => {
        expect(emojiValido('🍻')).toBe(true);
        expect(emojiValido('<b>')).toBe(false);
        expect(emojiValido('')).toBe(false);
        for (const l of LUGARES_BASE) expect(EMOJIS_LUGAR).toContain(l.emoji as (typeof EMOJIS_LUGAR)[number]);
    });

    it('busca polo texto do cartel sen acentos nin maiúsculas', () => {
        expect(buscarLugar('PRAZA  castelao', gardados)).toMatchObject({ id: 'praza-castelao', emoji: '🍻', lat: 42.65 });
        expect(buscarLugar('Praza da Igrexa', gardados)).toBeUndefined(); // aínda non colocado
        expect(buscarLugar('Sitio inventado', gardados)).toBeUndefined();
        expect(buscarLugar(undefined, gardados)).toBeUndefined();
    });

    it('todos os `lugar` do itinerario están no catálogo', () => {
        const todos = Object.fromEntries(LUGARES_BASE.map((l) => [l.id, { lat: 0, lng: 0, emoji: l.emoji }]));
        const actos = ITINERARIO.flatMap((d) => d.eventos);
        const lugares = [...new Set(actos.map((a) => a.lugar).filter((l): l is string => !!l))];
        expect(lugares.length).toBeGreaterThan(0);
        for (const l of lugares) expect(buscarLugar(l, todos), l).toBeDefined();
    });

    it('colocados, por id e URLs', () => {
        expect(lugaresColocados(gardados).map((l) => l.id)).toEqual(['praza-castelao']);
        expect(basePorId('auditorio')?.nome).toBe('Auditorio');
        expect(basePorId(null)).toBeUndefined();
        expect(mapaUrl({ id: 'a b' })).toBe('/mapa?lugar=a%20b');
        expect(mapsUrl({ lat: 1.5, lng: -2 })).toContain('destination=1.5%2C-2');
    });
});

describe('paleta da peña', () => {
    it('unha key descoñecida cae no preset por defecto', () => {
        expect(getPenaPreset('non-existe')).toBe(PENA_PRESETS[DEFAULT_PENA_COLOR]);
        expect(getPenaPreset(null)).toBe(PENA_PRESETS[DEFAULT_PENA_COLOR]);
        // nin sequera as do prototipo
        expect(getPenaPreset('toString')).toBe(PENA_PRESETS[DEFAULT_PENA_COLOR]);
    });

    it('o CSS inxectado só leva valores dos presets', () => {
        const css = penaColorStyle('</style><script>alert(1)</script>');
        expect(css).not.toContain('<');
        expect(css).toMatch(/^:root\{--primary:[^;{}]+;.*\}\.dark\{.*\}$/);
        for (const p of Object.values(PENA_PRESETS)) {
            for (const v of Object.values(p.vars)) expect(v).toMatch(/^[\d.% ]+$/);
        }
    });
});

describe('PIN', () => {
    it('catro díxitos exactos', () => {
        expect(PIN_REGEX.test('1234')).toBe(true);
        expect(PIN_REGEX.test('123')).toBe(false);
        expect(PIN_REGEX.test('12345')).toBe(false);
        expect(PIN_REGEX.test('12a4')).toBe(false);
    });
});

describe('esPenaColor', () => {
    it('solo as keys propias dos presets', () => {
        expect(esPenaColor('verde')).toBe(true);
        expect(esPenaColor('constructor')).toBe(false);
        expect(esPenaColor('__proto__')).toBe(false);
        expect(esPenaColor(7)).toBe(false);
        expect(() => penaColorStyle('constructor')).not.toThrow();
    });
});
