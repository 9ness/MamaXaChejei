import { describe, expect, it } from 'vitest';
import { calcularTempo } from '@/components/Countdown';
import { redondear } from '@/lib/use-now';
import { fai } from '@/lib/tempo';
import { DIAS_FESTA, diaDaFoto, diaDeHoxe } from '@/lib/festas';

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

describe('zona horaria dos tests', () => {
    it('corre en hora de Galicia (vitest.config.mts)', () => {
        expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Madrid');
    });
});

describe('redondear (useNow)', () => {
    it('dúas lecturas no mesmo tramo dan o mesmo número', () => {
        expect(redondear(1_234_567, 1000)).toBe(1_234_000);
        expect(redondear(1_234_999, 1000)).toBe(1_234_000);
        expect(redondear(1_234_567, 60_000)).toBe(1_200_000);
    });
});

describe('calcularTempo (conta atrás)', () => {
    const obxectivo = new Date('2026-09-12T00:00:00');

    it('xa pasou → null (o contador non se amosa)', () => {
        expect(calcularTempo(obxectivo, obxectivo)).toBeNull();
        expect(calcularTempo(obxectivo, new Date(obxectivo.getTime() + 1))).toBeNull();
    });

    it('desglosa horas, minutos e segundos', () => {
        const t = calcularTempo(obxectivo, new Date(obxectivo.getTime() - (HORA + 30 * MIN + 5_000)));
        expect(t).toEqual({ months: 0, weeks: 0, days: 0, hours: 1, minutes: 30, seconds: 5 });
    });

    it('semanas e días', () => {
        const t = calcularTempo(obxectivo, new Date(obxectivo.getTime() - 10 * DIA));
        expect(t).toMatchObject({ months: 0, weeks: 1, days: 3, hours: 0 });
    });

    it('o cambio de hora non come unha hora', () => {
        // de inverno (CET) a verán (CEST): 31 días de reloxo de parede
        const t = calcularTempo(new Date('2026-04-01T00:00:00'), new Date('2026-03-01T00:00:00'));
        expect(t).toMatchObject({ months: 1, weeks: 0, days: 1, hours: 0, minutes: 0 });
    });
});

describe('fai (hora das fotos)', () => {
    const agora = Date.parse('2026-09-13T12:00:00+02:00');

    it('relativo ata unha semana', () => {
        expect(fai(agora - 30_000, agora)).toBe('agora mesmo');
        expect(fai(agora - MIN, agora)).toBe('fai 1 minuto');
        expect(fai(agora - 38 * MIN, agora)).toBe('fai 38 minutos');
        expect(fai(agora - HORA, agora)).toBe('fai 1 hora');
        expect(fai(agora - 5 * HORA, agora)).toBe('fai 5 horas');
        expect(fai(agora - DIA, agora)).toBe('onte');
        expect(fai(agora - 3 * DIA, agora)).toBe('fai 3 días');
    });

    it('despois, a data (co ano se non é o mesmo)', () => {
        expect(fai(Date.parse('2026-08-15T12:00:00+02:00'), agora)).toBe('15 de agosto');
        expect(fai(Date.parse('2025-09-13T12:00:00+02:00'), agora)).toBe('13 de setembro de 2025');
    });

    it('datos raros non rompen', () => {
        expect(fai(Number.NaN, agora)).toBe('');
    });
});

describe('xornadas das festas', () => {
    const h = (iso: string) => Date.parse(iso);

    it('o corte é ás 08:00, non á medianoite', () => {
        expect(diaDaFoto(h('2026-09-12T04:00:00+02:00'))).toBe('venres1');
        expect(diaDaFoto(h('2026-09-12T07:59:59+02:00'))).toBe('venres1');
        expect(diaDaFoto(h('2026-09-12T08:00:00+02:00'))).toBe('sabado');
    });

    it('antes e despois', () => {
        expect(diaDaFoto(h('2026-09-10T23:00:00+02:00'))).toBe('pre');
        expect(diaDaFoto(h('2026-09-11T00:00:00+02:00'))).toBe('venres1');
        expect(diaDaFoto(h('2026-09-19T09:59:00+02:00'))).toBe('venres2');
        expect(diaDaFoto(h('2026-09-19T10:00:00+02:00'))).toBe('post');
        expect(diaDaFoto(h('2030-01-01T00:00:00Z'))).toBe('post');
    });

    it('os cortes están en orde e só o último é aberto', () => {
        const limites = DIAS_FESTA.slice(0, -1).map((d) => Date.parse(d.ata!));
        expect(limites).toEqual([...limites].sort((a, b) => a - b));
        expect(DIAS_FESTA.at(-1)?.ata).toBeNull();
        expect(diaDeHoxe(h('2026-09-14T20:00:00+02:00'))).toBe('luns');
    });
});
