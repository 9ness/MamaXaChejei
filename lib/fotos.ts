/**
 * Identidad de una foto para los "me gusta". Las fotos viven en una LIST de
 * Redis y no tienen id propio, así que se usa el nombre del fichero en Blob
 * (que ya lleva sufijo aleatorio, es único). Sirve también para las fotos
 * viejas, sin tener que migrar nada.
 */
export function fotoId(url: string): string {
    const limpio = String(url || '').split('?')[0];
    const ultimo = limpio.substring(limpio.lastIndexOf('/') + 1);
    return /^[A-Za-z0-9._-]{1,120}$/.test(ultimo) ? ultimo : '';
}
