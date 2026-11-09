/**
 * Los días de la Guadalupe, para ordenar las fotos por jornada.
 *
 * El corte NO es la medianoche: una foto de las 4 de la mañana del sábado es
 * de la noche del viernes, y así lo cuenta todo el mundo. Por eso cada día va
 * de las 08:00 a las 08:00 del siguiente. El primer viernes empieza a las 00:00
 * (antes de eso es pre-Guadalupe) y el último acaba el sábado a las 10:00.
 *
 * Las fechas llevan el desfase de Galicia (+02:00 en septiembre) escrito a mano:
 * así el corte es el mismo en el servidor y en el móvil, sin depender de la
 * zona horaria de cada uno. OJO: son las fechas PROVISIONALES de 2026, las
 * mismas de `lib/itinerario.ts`. Si cambia el cartel, hay que tocar los dos.
 */
export interface DiaFesta {
    id: string;
    etiqueta: string;
    /** El nombre de la peña para ese día ("Chupitaso", "Peñas"…). */
    alcume?: string;
    /** Fin (exclusivo) en ISO con desfase. `null` = no se acaba nunca. */
    ata: string | null;
}

export const DIAS_FESTA: DiaFesta[] = [
    { id: 'pre', etiqueta: 'Pre-Guada', ata: '2026-09-11T00:00:00+02:00' },
    { id: 'venres1', etiqueta: 'Venres 11', alcume: 'Chupitaso', ata: '2026-09-12T08:00:00+02:00' },
    { id: 'sabado', etiqueta: 'Sábado 12', ata: '2026-09-13T08:00:00+02:00' },
    { id: 'domingo', etiqueta: 'Domingo 13', ata: '2026-09-14T08:00:00+02:00' },
    { id: 'luns', etiqueta: 'Luns 14', alcume: 'Peñas', ata: '2026-09-15T08:00:00+02:00' },
    { id: 'martes', etiqueta: 'Martes 15', ata: '2026-09-16T08:00:00+02:00' },
    { id: 'mercores', etiqueta: 'Mércores 16', ata: '2026-09-17T08:00:00+02:00' },
    { id: 'xoves', etiqueta: 'Xoves 17', alcume: 'Feirón', ata: '2026-09-18T08:00:00+02:00' },
    { id: 'venres2', etiqueta: 'Venres 18', ata: '2026-09-19T10:00:00+02:00' },
    { id: 'post', etiqueta: 'Post-Guada', ata: null },
];

const LIMITES = DIAS_FESTA.map((d) => (d.ata ? Date.parse(d.ata) : Number.POSITIVE_INFINITY));

/** A qué jornada pertenece una foto por su hora. */
export function diaDaFoto(ts: number): string {
    for (let i = 0; i < LIMITES.length; i++) {
        if (ts < LIMITES[i]) return DIAS_FESTA[i].id;
    }
    return DIAS_FESTA[DIAS_FESTA.length - 1].id;
}

/** El día que toca ahora mismo, para abrir el selector por donde interesa. */
export function diaDeHoxe(agora: number): string {
    return diaDaFoto(agora);
}

// --- EN QUE MOMENTO DO ANO ESTAMOS ---

/** O ano do cartel que leva a app dentro (lib/itinerario.ts). */
export const ANO_FESTA = 2026;

const INICIO_FESTA = Date.parse(DIAS_FESTA[0].ata as string);
const FIN_FESTA = Date.parse(DIAS_FESTA[DIAS_FESTA.length - 2].ata as string);

export type FaseFesta = 'antes' | 'durante' | 'despois';

/**
 * Antes, durante ou despois da Guadalupe do cartel. A portada non pode ser a
 * mesma en novembro que o sábado da festa: pasada a derradeira xornada, o
 * programa enteiro en gris non lle di nada a ninguén.
 */
export function faseDaFesta(agora: number): FaseFesta {
    if (agora < INICIO_FESTA) return 'antes';
    return agora < FIN_FESTA ? 'durante' : 'despois';
}

/**
 * O día de setembro no que arranca a Guadalupe dun ano: o primeiro venres a
 * partir do día 8 (a festa da Virxe). Cadra cos carteis de 2023 (8), 2024
 * (13), 2025 (12) e 2026 (11), pero é unha REGRA, non o cartel: o que saia
 * de aquí hai que ensinalo sempre como data aproximada.
 */
export function venresDaGuadalupe(ano: number): number {
    const diaDaSemana = new Date(Date.UTC(ano, 8, 8)).getUTCDay(); // 5 = venres
    return 8 + ((5 - diaDaSemana + 7) % 7);
}

export interface ProximaGuadalupe {
    ano: number;
    /** Día de setembro (venres) no que empeza. */
    dia: number;
    /** As 00:00 dese venres, hora de Galicia. */
    inicio: number;
    /** true = sae da regra do venres e non dun cartel publicado. */
    estimada: boolean;
}

/** A seguinte Guadalupe que aínda non rematou, vista desde `agora`. */
export function proximaGuadalupe(agora: number): ProximaGuadalupe {
    const calcular = (ano: number): ProximaGuadalupe & { fin: number } => {
        const dia = venresDaGuadalupe(ano);
        const inicio = Date.parse(`${ano}-09-${String(dia).padStart(2, '0')}T00:00:00+02:00`);
        // Oito días e pico, coma a deste ano: ata o sábado seguinte pola mañá.
        return { ano, dia, inicio, fin: inicio + (FIN_FESTA - INICIO_FESTA), estimada: ano !== ANO_FESTA };
    };

    let p = calcular(new Date(agora).getUTCFullYear());
    if (agora >= p.fin) p = calcular(p.ano + 1);
    return { ano: p.ano, dia: p.dia, inicio: p.inicio, estimada: p.estimada };
}

/** Días enteiros que faltan (cara arriba: a 3 horas da festa "falta 1 día"). */
export function diasAta(inicio: number, agora: number): number {
    return Math.max(0, Math.ceil((inicio - agora) / 86_400_000));
}
