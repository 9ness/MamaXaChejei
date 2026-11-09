import { describe, expect, it } from 'vitest';
import { ANO_FESTA, diasAta, faseDaFesta, proximaGuadalupe, venresDaGuadalupe } from '@/lib/festas';
import { calcularResumo, miles, type DatosResumo } from '@/lib/resumo';
import type { Boleto } from '@/lib/lupebet';

const t = (iso: string) => Date.parse(iso);
const foto = (nome: string, iso: string, titulo?: string) => ({
    url: `https://x.public.blob.vercel-storage.com/fotos/${nome}.webp`,
    ts: t(iso),
    ...(titulo ? { titulo } : {}),
});
const boleto = (id: string, extra: Partial<Boleto> & { apostado?: number; apostantes?: number } = {}) => ({
    id, codigo: id.toUpperCase(), titulo: `Boleto ${id}`, nombre: 'Lupe', lineas: [], importe: 10,
    fecha: '11/09/2026', ts: 1, ...extra,
}) as Boleto;

const baleiros: DatosResumo = {
    fotos: [], likes: {}, audios: [], likesAudios: {}, boletos: [], xogo: [], moedas: [], mensaxes: 0, partidas: 0,
};

describe('fase da festa', () => {
    it('antes, durante e despois do cartel', () => {
        expect(faseDaFesta(t('2026-09-10T23:59:00+02:00'))).toBe('antes');
        expect(faseDaFesta(t('2026-09-11T00:00:00+02:00'))).toBe('durante');
        // A madrugada do último sábado aínda é festa: remata ás 10:00.
        expect(faseDaFesta(t('2026-09-19T09:59:00+02:00'))).toBe('durante');
        expect(faseDaFesta(t('2026-09-19T10:00:00+02:00'))).toBe('despois');
        expect(faseDaFesta(t('2026-11-09T22:00:00+01:00'))).toBe('despois');
    });
});

describe('a seguinte Guadalupe', () => {
    it('a regra do venres cadra cos carteis coñecidos', () => {
        expect(venresDaGuadalupe(2023)).toBe(8);
        expect(venresDaGuadalupe(2024)).toBe(13);
        expect(venresDaGuadalupe(2025)).toBe(12);
        expect(venresDaGuadalupe(2026)).toBe(11);
        expect(venresDaGuadalupe(2027)).toBe(10);
        for (let ano = 2020; ano < 2060; ano++) {
            const dia = venresDaGuadalupe(ano);
            expect(dia).toBeGreaterThanOrEqual(8);
            expect(dia).toBeLessThanOrEqual(14);
            expect(new Date(Date.UTC(ano, 8, dia)).getUTCDay()).toBe(5);
        }
    });

    it('antes e durante a festa, a do cartel (sen aviso de aproximada)', () => {
        for (const agora of ['2026-01-01T12:00:00+01:00', '2026-09-15T12:00:00+02:00']) {
            const p = proximaGuadalupe(t(agora));
            expect(p).toEqual({ ano: ANO_FESTA, dia: 11, inicio: t('2026-09-11T00:00:00+02:00'), estimada: false });
        }
    });

    it('pasada a festa, a do ano seguinte e marcada como aproximada', () => {
        const p = proximaGuadalupe(t('2026-11-09T22:00:00+01:00'));
        expect(p).toEqual({ ano: 2027, dia: 10, inicio: t('2027-09-10T00:00:00+02:00'), estimada: true });
        // O 1 de xaneiro xa é "este ano", pero segue sendo a mesma festa.
        expect(proximaGuadalupe(t('2027-01-01T00:30:00+01:00')).ano).toBe(2027);
        // E se ninguén actualiza o cartel, ao pasar a de 2027 salta á de 2028.
        expect(proximaGuadalupe(t('2027-10-01T00:00:00+02:00')).ano).toBe(2028);
    });

    it('os días contan cara arriba e nunca baixan de cero', () => {
        const inicio = t('2027-09-10T00:00:00+02:00');
        expect(diasAta(inicio, t('2027-09-09T21:00:00+02:00'))).toBe(1);
        expect(diasAta(inicio, t('2027-09-09T00:00:00+02:00'))).toBe(1);
        expect(diasAta(inicio, t('2027-09-08T23:59:00+02:00'))).toBe(2);
        expect(diasAta(inicio, inicio)).toBe(0);
        expect(diasAta(inicio, inicio + 5_000)).toBe(0);
    });
});

describe('o resumo da festa', () => {
    it('sen datos non hai nada que contar', () => {
        const r = calcularResumo(baleiros);
        expect(r.baleiro).toBe(true);
        expect(r.podioFotos).toEqual([]);
        expect(r.porDia).toEqual([]);
        expect(r.diaTop).toBeNull();
        expect(r.cancionTop).toBeNull();
        expect(r.boletoTop).toBeNull();
    });

    it('aguanta datos a medias (Redis caído devolve cousas raras)', () => {
        const r = calcularResumo({
            ...baleiros,
            likes: { 'a.webp': Number.NaN, 'b.webp': -3 } as Record<string, number>,
            fotos: [foto('a', '2026-09-12T12:00:00+02:00'), foto('b', '2026-09-12T13:00:00+02:00')],
            mensaxes: Number.NaN,
            partidas: -1,
        });
        expect(r.cifras).toMatchObject({ fotos: 2, lumes: 0, mensaxes: 0, partidas: 0 });
        expect(r.podioFotos).toEqual([]);
        expect(r.baleiro).toBe(false);
    });

    it('podio: só fotos con lume, e en empate a máis antiga', () => {
        const fotos = [
            foto('nova', '2026-09-13T20:00:00+02:00'),
            foto('vella', '2026-09-12T20:00:00+02:00', 'A primeira'),
            foto('top', '2026-09-14T20:00:00+02:00'),
            foto('cuarta', '2026-09-14T21:00:00+02:00'),
            foto('fria', '2026-09-14T22:00:00+02:00'),
        ];
        const r = calcularResumo({
            ...baleiros,
            fotos,
            // "borrada.webp" xa non está no mural: o seu contador non suma.
            likes: { 'nova.webp': 4, 'vella.webp': 4, 'top.webp': 9, 'cuarta.webp': 1, 'borrada.webp': 50 },
        });
        expect(r.podioFotos.map((f) => f.lumes)).toEqual([9, 4, 4]);
        expect(r.podioFotos[1].titulo).toBe('A primeira');
        expect(r.cifras.lumes).toBe(18);
    });

    it('fotos por xornada: a madrugada conta para a noite anterior e os ocos quedan', () => {
        const r = calcularResumo({
            ...baleiros,
            fotos: [
                foto('a', '2026-09-11T23:00:00+02:00'),
                foto('b', '2026-09-12T04:00:00+02:00'),   // aínda é o venres do Chupitaso
                foto('c', '2026-09-14T22:00:00+02:00'),
                foto('d', '2026-09-15T02:00:00+02:00'),
                foto('e', '2026-09-15T03:00:00+02:00'),
            ],
        });
        expect(r.porDia.map((d) => [d.id, d.fotos])).toEqual([
            ['venres1', 2], ['sabado', 0], ['domingo', 0], ['luns', 3],
        ]);
        expect(r.diaTop).toMatchObject({ id: 'luns', alcume: 'Peñas', fotos: 3 });
    });

    it('en empate de xornadas manda a orde da festa', () => {
        const r = calcularResumo({
            ...baleiros,
            fotos: [foto('a', '2026-09-13T12:00:00+02:00'), foto('b', '2026-09-12T12:00:00+02:00')],
        });
        expect(r.diaTop?.id).toBe('sabado');
    });

    it('cancións, LupeBet e clasificacións', () => {
        const r = calcularResumo({
            ...baleiros,
            audios: [
                { url: 'https://x/audios/himno.mp3', ts: 1, titulo: 'O himno' },
                { url: 'https://x/audios/outra.m4a', ts: 2, titulo: '' },
            ],
            likesAudios: { 'himno.mp3': 7, 'outra.m4a': 2 },
            boletos: [
                boleto('a', { apostado: 300, apostantes: 2, estado: 'ganado' }),
                boleto('b', { apostado: 1200, apostantes: 5, estado: 'perdido' }),
                boleto('c'),
            ],
            xogo: [{ name: 'Ana', score: 80 }, { name: 'Xan', score: 0 }],
            moedas: [
                { nombre: 'A', saldo: 5000 }, { nombre: 'B', saldo: 3000 },
                { nombre: 'C', saldo: 2000 }, { nombre: 'D', saldo: 1000 },
            ],
            mensaxes: 412,
            partidas: 96,
        });
        expect(r.cancionTop).toEqual({ titulo: 'O himno', lumes: 7 });
        expect(r.cifras).toEqual({
            fotos: 0, lumes: 9, cancions: 2, mensaxes: 412, partidas: 96, boletos: 3, moedasApostadas: 1500,
        });
        expect(r.boletoTop).toMatchObject({ id: 'b', apostado: 1200, apostantes: 5 });
        expect(r.boletosPechados).toEqual({ ganados: 1, perdidos: 1 });
        expect(r.xogo).toEqual([{ name: 'Ana', score: 80 }]);
        expect(r.moedas).toHaveLength(3);
        expect(r.baleiro).toBe(false);
    });

    it('sen apostas non hai boleto máis xogado', () => {
        expect(calcularResumo({ ...baleiros, boletos: [boleto('a'), boleto('b')] }).boletoTop).toBeNull();
    });
});

describe('miles', () => {
    it('pon os puntos igual en calquera máquina', () => {
        expect(miles(0)).toBe('0');
        expect(miles(999)).toBe('999');
        expect(miles(1000)).toBe('1.000');
        expect(miles(1234567)).toBe('1.234.567');
        expect(miles(1499.6)).toBe('1.500');
    });
});
