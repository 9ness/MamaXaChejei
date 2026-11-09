/**
 * Constantes del chat que comparten el cliente (GlobalChat) y la API
 * (`app/api/chat`). Sin imports de servidor: este fichero entra en el bundle
 * del navegador.
 */

/** Las únicas reacciones que existen. La API rechaza cualquier otra. */
export const REACTION_EMOJIS = ['😂', '❤️', '🔥', '🍻', '🥳', '💩'] as const;

export function esEmojiValido(emoji: unknown): emoji is (typeof REACTION_EMOJIS)[number] {
    return typeof emoji === 'string' && (REACTION_EMOJIS as readonly string[]).includes(emoji);
}

/** Cuántos mensajes guarda la lista (LTRIM 0 49). */
export const CHAT_MAX = 50;
