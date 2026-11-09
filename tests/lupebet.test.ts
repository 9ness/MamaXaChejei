import { describe, expect, it } from 'vitest';
import {
    BOLETO_OFICIAL,
    DERIVA_MAX,
    MAX_CUOTA,
    MAX_MULTIPLICADOR,
    MIN_CUOTA,
    barcodeWidths,
    cuotaContraria,
    cuotaDeProbabilidad,
    cuotaTotal,
    eur,
    fechaBoleto,
    ganancia,
    mercadoBoleto,
    multiplicadorAposta,
    multiplicadorContra,
    multiplicadorPago,
    probabilidadDeCuota,
    type Aposta,
    type BoletoLinea,
} from '@/lib/lupebet';

const linea = (cuota: number): BoletoLinea => ({ apuesta: 'x', pronostico: 'y', cuota });
const OFICIAL = BOLETO_OFICIAL.lineas;

describe('cuotas e probabilidades', () => {
    it('unha cuota é unha probabilidade disfrazada', () => {
        expect(probabilidadDeCuota(1.3)).toBe(77);
        expect(probabilidadDeCuota(2)).toBe(50);
        // cuotas sen sentido (≤ 1) son "case seguro"
        expect(probabilidadDeCuota(1)).toBe(99);
        expect(probabilidadDeCuota(0.5)).toBe(99);
        expect(probabilidadDeCuota(Number.NaN)).toBe(99);
        // nunca baixa de 1 %
        expect(probabilidadDeCuota(1000)).toBe(1);
    });

    it('e volta: probabilidade → cuota, cos topes', () => {
        expect(cuotaDeProbabilidad(77)).toBe(1.3);
        expect(cuotaDeProbabilidad(50)).toBe(2);
        expect(cuotaDeProbabilidad(0)).toBe(MAX_CUOTA);
        expect(cuotaDeProbabilidad(100)).toBe(MIN_CUOTA);
    });

    it('a contraria leva o marxe da casa', () => {
        expect(cuotaContraria(1.3)).toBe(3.44);
        expect(cuotaContraria(1.01)).toBe(14.31);
        // o disparate da camiseta: ir en contra case non paga
        expect(cuotaContraria(28.12)).toBe(MIN_CUOTA);
        // e sen resto posible, o tope
        expect(cuotaContraria(0.5)).toBe(MAX_CUOTA);
    });
});

describe('combinada', () => {
    it('a cuota total é o produto (e a impresa na camiseta NON coincide, a propósito)', () => {
        expect(cuotaTotal(OFICIAL)).toBeCloseTo(26.04, 2);
        expect(BOLETO_OFICIAL.cuotaTotal).toBe(28.12);
        expect(cuotaTotal([])).toBe(1);
        // unha cuota rota conta como 1, non tumba o boleto
        expect(cuotaTotal([linea(2), { apuesta: 'a', pronostico: 'b', cuota: Number.NaN }])).toBe(2);
    });

    it('a ganancia é importe × cuota', () => {
        expect(ganancia(10, [linea(2), linea(1.5)])).toBe(30);
    });

    it('o pago está topado en MAX_MULTIPLICADOR', () => {
        const disparate = Array.from({ length: 8 }, () => linea(50));
        expect(multiplicadorPago(disparate)).toBe(MAX_MULTIPLICADOR);
        expect(multiplicadorPago([linea(2), linea(3)])).toBe(6);
        expect(multiplicadorContra(OFICIAL)).toBe(MIN_CUOTA);
    });
});

describe('mercadoBoleto', () => {
    it('sen diñeiro, o "si" paga EXACTAMENTE o que pon o boleto', () => {
        const m = mercadoBoleto([linea(2)]);
        expect(m.si).toBe(2);
        expect(m.baseSi).toBe(2);
        expect(m.non).toBe(1.79); // 1 / (1 + 0.06 - 0.5)
        expect(m.prob).toBe(50);

        const oficial = mercadoBoleto(OFICIAL);
        expect(oficial.si).toBe(26.04);
        expect(oficial.prob).toBe(4);
    });

    it('o diñeiro move a cuota: o lado cargado paga menos e o outro máis', () => {
        const base = mercadoBoleto([linea(2)]);
        const cargadoSi = mercadoBoleto([linea(2)], 500, 0);
        expect(cargadoSi.si).toBeLessThan(base.si);
        expect(cargadoSi.non).toBeGreaterThan(base.non);
        expect(cargadoSi.baseSi).toBe(base.si);

        const cargadoNon = mercadoBoleto([linea(2)], 0, 500);
        expect(cargadoNon.si).toBeGreaterThan(base.si);
    });

    it('25 moedas apenas a rozan', () => {
        const m = mercadoBoleto(OFICIAL, 25, 0);
        expect(m.si).toBeGreaterThan(24);
    });

    it('nunca se vai máis aló de DERIVA_MAX nas odds', () => {
        // pBase 0.5 (odds 1) → como moito odds 2.5 → p 0.714 → cuota 1.4
        const m = mercadoBoleto([linea(2)], 1e12, 0);
        expect(m.si).toBeCloseTo(1 / (DERIVA_MAX / (1 + DERIVA_MAX)), 2);
        const n = mercadoBoleto([linea(2)], 0, 1e12);
        expect(n.si).toBeCloseTo(1 + DERIVA_MAX, 2);
    });

    it('sanea os totais', () => {
        const m = mercadoBoleto([linea(2)], -50, Number.NaN);
        expect(m.totalSi).toBe(0);
        expect(m.totalNon).toBe(0);
        expect(mercadoBoleto([linea(2)], 10.9, 3.2)).toMatchObject({ totalSi: 10, totalNon: 3 });
    });
});

describe('multiplicadorAposta', () => {
    const aposta = (a: Partial<Aposta>): Aposta => ({ nombre: 'x', moedas: 10, ts: 0, ...a });
    const lineas = [linea(2), linea(3)];

    it('paga á cuota conxelada ao apostar', () => {
        expect(multiplicadorAposta(aposta({ lado: 'si', cuota: 3.5 }), lineas)).toBe(3.5);
        expect(multiplicadorAposta(aposta({ lado: 'non', cuota: 1.2 }), lineas)).toBe(1.2);
    });

    it('a conxelada tamén leva tope', () => {
        expect(multiplicadorAposta(aposta({ cuota: 99999 }), lineas)).toBe(MAX_MULTIPLICADOR);
    });

    it('as apostas vellas, sen cuota, cobran á de saída', () => {
        expect(multiplicadorAposta(aposta({}), lineas)).toBe(6);
        expect(multiplicadorAposta(aposta({ lado: 'non' }), lineas)).toBe(multiplicadorContra(lineas));
        // unha cuota inválida gardada non se usa
        expect(multiplicadorAposta(aposta({ cuota: 1 }), lineas)).toBe(6);
    });
});

describe('formatos', () => {
    it('eur a man, sen depender do locale', () => {
        expect(eur(1234.5)).toBe('1.234,50');
        expect(eur(0)).toBe('0,00');
        expect(eur(-1234567.891)).toBe('-1.234.567,89');
        expect(eur(281.2)).toBe('281,20');
    });

    it('a data do ticket vai en hora de Galicia', () => {
        expect(fechaBoleto(Date.parse('2026-09-10T21:48:32+02:00'))).toBe('10/09/26  21:48:32');
        // en inverno, +01:00
        expect(fechaBoleto(Date.parse('2026-12-24T23:05:09Z'))).toBe('25/12/26  00:05:09');
    });

    it('o código de barras é determinista', () => {
        const a = barcodeWidths('X8V2N7K');
        expect(a).toHaveLength(48);
        expect(a).toEqual(barcodeWidths('X8V2N7K'));
        expect(a).not.toEqual(barcodeWidths('OUTRO'));
        expect(a.every((w) => w >= 1 && w <= 4)).toBe(true);
    });
});
