/**
 * Identidad anónima por dispositivo. La misma clave `anon_id` que ya usa el
 * mapa (`components/MapaClient.tsx`), para que sea la MISMA persona en toda la
 * app sin que nadie tenga que crear cuenta.
 *
 * No es autenticación: quien borre los datos del navegador vuelve a ser alguien
 * nuevo. Para una peña de bromas es el trato aceptado; no lo uses para nada que
 * importe de verdad.
 */
export function getAnonId(): string {
    let id = localStorage.getItem('anon_id');
    if (!id) {
        id = crypto.randomUUID?.() ?? String(Math.random()).slice(2);
        localStorage.setItem('anon_id', id);
    }
    return id;
}
