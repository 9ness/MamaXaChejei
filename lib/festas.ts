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
