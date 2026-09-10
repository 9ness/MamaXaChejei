'use client';

/**
 * Las insignias del menú (mapa, fotos) y la del chat.
 *
 * Un solo componente pregunta al servidor —`BottomNav`, que está montado
 * siempre— y reparte el resultado por aquí. Si cada insignia preguntase por su
 * cuenta serían tres consultas a Redis por vuelta en vez de una, y esto se
 * repite cada poco tiempo en el móvil de cada uno.
 */
export interface Avisos {
    /** Cuánta gente está compartiendo ubicación AHORA. No hay "visto" que valga. */
    ubicacions: number;
    /** Contadores que solo suben: mensajes y fotos publicados desde siempre. */
    chatN: number;
    fotosN: number;
}

export const AVISOS_VACIOS: Avisos = { ubicacions: 0, chatN: 0, fotosN: 0 };

let estado: Avisos = AVISOS_VACIOS;
const subscritores = new Set<() => void>();

export function publicarAvisos(a: Avisos) {
    estado = a;
    subscritores.forEach((f) => f());
}

export function subscribirAvisos(f: () => void) {
    subscritores.add(f);
    return () => { subscritores.delete(f); };
}

/**
 * "Mira agora mismo". Compartir ubicación o dejar de compartir tiene que verse
 * en la insignia del mapa al momento, no dentro de 45 segundos.
 */
const oíntes = new Set<() => void>();

export function aoPedirRefresco(f: () => void) {
    oíntes.add(f);
    return () => { oíntes.delete(f); };
}

export function pedirRefresco() {
    oíntes.forEach((f) => f());
}

export function lerAvisos(): Avisos {
    return estado;
}

/** En el servidor no hay nada que enseñar: las insignias son cosa del navegador. */
export function lerAvisosNoServidor(): Avisos {
    return AVISOS_VACIOS;
}

type Clave = 'chat' | 'fotos';

/**
 * Lo que este móvil ya vio. Es un contador, no una fecha: así la insignia dice
 * "3" sin tener que leer la lista entera para contar cuántos son nuevos.
 */
export function lerVisto(clave: Clave): number | null {
    try {
        const raw = localStorage.getItem(`visto_${clave}`);
        return raw === null ? null : Number(raw) || 0;
    } catch {
        return null;
    }
}

export function marcarVisto(clave: Clave, valor: number) {
    try {
        localStorage.setItem(`visto_${clave}`, String(valor));
    } catch {
        // modo incógnito y poco más: sin guardar, la insignia vuelve a salir
    }
    subscritores.forEach((f) => f());
}
