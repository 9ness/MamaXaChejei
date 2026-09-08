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
    /** Moedas apostadas y cuánta gente apostó. Contadores aparte, para no leer
     *  las apuestas de los 200 boletos cada vez que se pinta la lista. */
    apostado?: number;
    apostantes?: number;
    /** Lo marca el admin: sale arriba, en "Os pronósticos da peña". */
    destacado?: boolean;
}

export type EstadoBoleto = 'aberto' | 'ganado' | 'perdido';

/** Moedas con las que arranca cada móvil la primera vez. */
export const SALDO_INICIAL = 1000;
/** Tope duro por apuesta. Antes eran 500 y no dejaba jugarse el saldo entero;
 *  ahora el que manda es el saldo y esto solo es red de seguridad. */
export const MAX_APOSTA = 100000;

/** A favor de que el boleto salga, o en contra. */
export type LadoAposta = 'si' | 'non';

export interface Aposta {
    nombre: string;
    moedas: number;
    ts: number;
    /** Las apuestas de antes de existir los dos lados eran todas a favor. */
    lado?: LadoAposta;
    /** La cuota que había EN EL MOMENTO de apostar, congelada como en las casas
     *  de verdad. Las apuestas viejas no la tienen: cobran a la de salida. */
    cuota?: number;
}

export interface ApostasBoleto {
    total: number;
    totalSi: number;
    totalNon: number;
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

/** Lo que paga apostar A FAVOR, ya con el tope aplicado. */
export function multiplicadorPago(lineas: BoletoLinea[]): number {
    return Math.min(MAX_MULTIPLICADOR, cuotaTotal(lineas));
}

/**
 * Lo que paga apostar EN CONTRA. Sale de la cuota contraria de la combinada
 * entera: si el boleto es un disparate que paga 28, ir en contra es casi
 * seguro y por eso apenas paga (se queda en el mínimo, 1,01). Es lo correcto.
 */
export function multiplicadorContra(lineas: BoletoLinea[]): number {
    return Math.min(MAX_MULTIPLICADOR, cuotaContraria(cuotaTotal(lineas)));
}

// --- MERCADO: as cuotas móvense co diñeiro, como nas de verdade ---
// Una casa de apuestas no deja la cuota quieta: si todo el mundo carga a un
// lado, ese lado paga menos y el contrario paga más. Aquí igual, con las moedas
// de la peña haciendo de mercado.

/**
 * Cuánto pesa la cuota de salida frente a las moedas de la peña. Con 300, las
 * primeras apuestas mueven poco y a partir del millar manda el dinero.
 */
export const LIQUIDEZ = 300;

/**
 * Cuánto puede llegar a moverse el precio como mucho, con el mercado entero a
 * un lado: la probabilidad (en apuestas, la "cuota justa") no se va más del
 * ×2,5 arriba ni abajo de la de salida. Sin freno, cuatro apuestas dejarían la
 * cuota irreconocible respecto a la que pone el boleto, que es el chiste.
 */
export const DERIVA_MAX = 2.5;

export interface Mercado {
    /** Lo que paga cada lado AHORA MISMO, con el dinero que hay encima. */
    si: number;
    non: number;
    /** Lo que pagaba sin nadie apostando, para poder enseñar el movimiento. */
    baseSi: number;
    baseNon: number;
    /** Probabilidad de que salga, 0-100, ya con el dinero dentro. */
    prob: number;
    /** Moedas a cada lado, ya saneadas. */
    totalSi: number;
    totalNon: number;
}

function topeCuota(c: number): number {
    if (!Number.isFinite(c)) return MIN_CUOTA;
    return Math.min(MAX_MULTIPLICADOR, Math.max(MIN_CUOTA, Math.round(c * 100) / 100));
}

/**
 * De una probabilidad a las dos cuotas. El margen de la casa se lo come entero
 * el lado del "non", a propósito: así el "si" arranca EXACTAMENTE en la cuota
 * que pone el boleto (que es el chiste) en vez de salir recortada.
 */
function cuotasDeProb(p: number): { si: number; non: number } {
    return { si: topeCuota(1 / p), non: topeCuota(1 / (1 + MARGEN - p)) };
}

/**
 * Estado del mercado de un boleto con las moedas que lleva cada lado.
 *
 * El precio se mueve en "log-odds", que es como se mueve de verdad: la presión
 * del dinero (cuánto se desequilibra el mercado, de -1 a +1) desplaza la cuota
 * de salida de forma suave y simétrica. Así 25 moedas apenas la rozan, y hacen
 * falta cientos para moverla de verdad — un boleto de cuota 26 no se desploma a
 * 3 porque alguien meta 100 moedas, pero baja a 21, y el "non" sube.
 */
export function mercadoBoleto(lineas: BoletoLinea[], totalSi = 0, totalNon = 0): Mercado {
    const base = Math.max(MIN_CUOTA, cuotaTotal(lineas));
    const pBase = Math.min(0.99, Math.max(1 / MAX_MULTIPLICADOR, 1 / base));

    const si = Math.max(0, Math.floor(Number(totalSi)) || 0);
    const non = Math.max(0, Math.floor(Number(totalNon)) || 0);

    // LIQUIDEZ moedas imaginarias defendiendo el precio de salida: con poco
    // dinero encima la presión es casi cero y la cuota no se entera.
    const presion = (si - non) / (LIQUIDEZ + si + non);
    const logit = Math.log(pBase / (1 - pBase)) + presion * Math.log(DERIVA_MAX);
    const p = Math.min(0.99, Math.max(1 / MAX_MULTIPLICADOR, 1 / (1 + Math.exp(-logit))));

    const ahora = cuotasDeProb(p);
    const salida = cuotasDeProb(pBase);

    return {
        si: ahora.si,
        non: ahora.non,
        baseSi: salida.si,
        baseNon: salida.non,
        prob: Math.min(99, Math.max(1, Math.round(p * 100))),
        totalSi: si,
        totalNon: non,
    };
}

/**
 * Lo que cobra una apuesta ganadora. La cuota se CONGELA al apostar, como en
 * las casas de verdad: el que entra pronto se lleva la cuota buena aunque
 * después el mercado se mueva. Las apuestas viejas no la llevan guardada, así
 * que cobran a la cuota de salida — que es justo lo que había cuando se
 * hicieron.
 */
export function multiplicadorAposta(a: Aposta, lineas: BoletoLinea[]): number {
    const congelada = Number(a.cuota);
    if (Number.isFinite(congelada) && congelada > 1) {
        return Math.min(MAX_MULTIPLICADOR, congelada);
    }
    return (a.lado ?? 'si') === 'si' ? multiplicadorPago(lineas) : multiplicadorContra(lineas);
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
