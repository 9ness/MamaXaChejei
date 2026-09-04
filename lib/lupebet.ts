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
export const MAX_CUOTA = 999;

/** Producto de las cuotas, como en una combinada de verdad. */
export function cuotaTotal(lineas: BoletoLinea[]): number {
    return lineas.reduce((acc, l) => acc * (Number(l.cuota) || 1), 1);
}

export function ganancia(importe: number, lineas: BoletoLinea[]): number {
    return importe * cuotaTotal(lineas);
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
