// LupeBet: el boleto de la espalda de la camiseta de J'26, y el molde para los
// que se inventa la peña. Esto son DATOS, no lógica (mismo criterio que
// lib/itinerario.ts): si cambia la camiseta, se cambia aquí.

export interface BoletoLinea {
    /** El texto de la apuesta. */
    apuesta: string;
    /** El pronóstico elegido: "Máis de 50'5", "Sí", "MXC"… */
    pronostico: string;
    cuota: number;
}

export interface Boleto {
    id: string;
    /** Código corto que se enseña en el ticket. */
    codigo: string;
    titulo: string;
    nombre: string;
    lineas: BoletoLinea[];
    importe: number;
    /** Ya formateada al crearlo. Se guarda hecha para que el ticket pinte igual
     *  en el servidor (UTC) que en el navegador y no rompa la hidratación. */
    fecha: string;
    /** Epoch ms, solo para ordenar. */
    ts: number;
    /** Lo pone el admin al cerrarlo. Sin resolver = 'aberto'. */
    estado?: EstadoBoleto;
    /** Moedas apostadas en total. Contador aparte, para no leer las apuestas
     *  de los 200 boletos cada vez que se pinta la lista. */
    apostado?: number;
}

export type EstadoBoleto = 'aberto' | 'ganado' | 'perdido';

/** Moedas con las que arranca cada móvil la primera vez. */
export const SALDO_INICIAL = 1000;
/** Tope por apuesta, para que nadie funda el saldo de golpe sin querer. */
export const MAX_APOSTA = 500;

export interface Aposta {
    nombre: string;
    moedas: number;
    ts: number;
}

export interface ApostasBoleto {
    total: number;
    apostantes: Aposta[];
}

/**
 * Azul marino de las mangas de la camiseta de J'26. Va a fuego y NO sale de
 * `lib/pena-colors.ts` a propósito: el boleto tiene que verse igual que la
 * camiseta aunque el admin cambie la paleta de la peña.
 */
export const LUPE_AZUL = '#1D2A7C';
export const LUPE_AZUL_CLARO = '#2E3FA8';

export const MAX_LINEAS = 8;
export const MAX_IMPORTE = 1000;
export const MIN_CUOTA = 1.01;
export const MAX_CUOTA = 50;

/**
 * Margen de la casa, como en las de verdad: las probabilidades de un mercado
 * suman algo más de 1 y esa diferencia es lo que se queda la banca.
 */
export const MARGEN = 0.06;

/** Cuánto paga como máximo un boleto, pase lo que pase. Sin este tope, ocho
 *  líneas a cuota 50 pagarían 39.000 millones de moedas y revientan el juego. */
export const MAX_MULTIPLICADOR = 500;

/** Una cuota ES una probabilidad disfrazada: 1,30 → 77% de que pase. */
export function probabilidadDeCuota(cuota: number): number {
    if (!(cuota > 1)) return 99;
    return Math.min(99, Math.max(1, Math.round(100 / cuota)));
}

/** El camino de vuelta: 77% → cuota 1,30. */
export function cuotaDeProbabilidad(pct: number): number {
    const p = Math.min(99, Math.max(2, Math.round(pct)));
    return Math.min(MAX_CUOTA, Math.max(MIN_CUOTA, Math.round((100 / p) * 100) / 100));
}

/**
 * La cuota que tendría lo contrario, con el margen de la casa incluido.
 * Cuota 1,30 (77%) → lo contrario tiene un 23% → paga 3,44.
 */
export function cuotaContraria(cuota: number): number {
    const resto = 1 + MARGEN - 1 / cuota;
    if (resto <= 1 / MAX_CUOTA) return MAX_CUOTA;
    return Math.min(MAX_CUOTA, Math.max(MIN_CUOTA, Math.round((1 / resto) * 100) / 100));
}

/** Producto de las cuotas, como en una combinada de verdad. */
export function cuotaTotal(lineas: BoletoLinea[]): number {
    return lineas.reduce((acc, l) => acc * (Number(l.cuota) || 1), 1);
}

export function ganancia(importe: number, lineas: BoletoLinea[]): number {
    return importe * cuotaTotal(lineas);
}

/** Lo que se paga de verdad al resolver, ya con el tope aplicado. */
export function multiplicadorPago(lineas: BoletoLinea[]): number {
    return Math.min(MAX_MULTIPLICADOR, cuotaTotal(lineas));
}

/**
 * 1234.5 → "1.234,50". A mano y no con toLocaleString: este número se pinta en
 * servidor y en cliente, y un formateo que dependa del locale del navegador
 * rompería la hidratación.
 */
export function eur(n: number): string {
    const [int, dec] = Math.abs(n).toFixed(2).split('.');
    const miles = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${n < 0 ? '-' : ''}${miles},${dec}`;
}

/** Fecha del ticket, fijada en hora de Galicia al crear el boleto. */
export function fechaBoleto(ts: number): string {
    const f = new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid',
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).formatToParts(new Date(ts));
    const g = (t: string) => f.find((p) => p.type === t)?.value ?? '00';
    return `${g('day')}/${g('month')}/${g('year')}  ${g('hour')}:${g('minute')}:${g('second')}`;
}

/**
 * El boleto de la camiseta, tal cual está impreso — faltas incluidas, que son
 * parte del chiste. OJO: la cuota total impresa (28,12) no es el producto exacto
 * de las 7 líneas (sale 26,04). Se respeta lo que pone la camiseta, por eso el
 * oficial lleva sus totales escritos a mano en vez de calculados.
 */
export const BOLETO_OFICIAL = {
    id: 'oficial',
    idBoleto: 'LB-100926-003542',
    codigo: 'X8V2N7K',
    titulo: 'APUESTA COMBINADA',
    fecha: '10/09/26  21:48:32',
    estado: 'Aceptada',
    tipo: 'Combinada',
    importe: 10,
    cuotaTotal: 28.12,
    ganancia: 281.2,
    lineas: [
        { apuesta: 'Nº de controles de Terremoto', pronostico: "Máis de 50'5", cuota: 1.1 },
        { apuesta: 'Janador dos contenedores', pronostico: 'MXC', cuota: 1.4 },
        { apuesta: 'Nº de veses que sona a Rianxeira', pronostico: "Máis de 25'5", cuota: 1.3 },
        { apuesta: 'Próximo evento copiado nas Festas de Boiro', pronostico: 'Feirón Mariñeiro', cuota: 1.7 },
        { apuesta: 'Cant@s veses os de fóra cantan "Non te vaias" en ves de "Non te embarques"', pronostico: "Menos de 13'5", cuota: 7.5 },
        { apuesta: 'No discurso de Carlos sona "Po ano 15 días"', pronostico: 'Sí', cuota: 1.01 },
        { apuesta: 'Decepcionará a camiseta de Outro Trajo', pronostico: 'Sí', cuota: 1.01 },
    ] as BoletoLinea[],
} as const;

/**
 * Barras deterministas a partir del código: siempre el mismo dibujo para el
 * mismo boleto. Decorativo, no codifica nada.
 */
export function barcodeWidths(seed: string, count = 48): number[] {
    let h = 2166136261;
    for (const ch of seed) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 16777619);
    }
    return Array.from({ length: count }, () => {
        h = Math.imul(h ^ (h >>> 15), 2246822507);
        h ^= h >>> 13;
        return 1 + (Math.abs(h) % 4);
    });
}
