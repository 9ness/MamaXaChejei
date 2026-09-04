/**
 * Constantes del PIN compartidas con los componentes de cliente.
 * Viven aquí y no en `lib/admin-pin.ts` porque aquel importa `crypto` y el
 * cliente de Redis, y no puede entrar en un bundle de navegador.
 */
export const PIN_LENGTH = 4;
export const PIN_REGEX = /^\d{4}$/;
