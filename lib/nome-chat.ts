'use client';

import { useSyncExternalStore } from 'react';

/** Clave de localStorage co nome que cada un usa no chat, LupeBet e o mapa. */
export const CHAVE_NOME_CHAT = 'chat_username';

/** El nombre que ya usa en el chat. Con useSyncExternalStore y no con un efecto
 *  porque en el servidor no hay localStorage: así React sabe que el valor del
 *  servidor es "" y lo rehace en cliente sin romper la hidratación. */
export function useNombreGuardado(): string {
    return useSyncExternalStore(
        () => () => {},                                         // no cambia solo
        () => {
            try { return localStorage.getItem(CHAVE_NOME_CHAT) || ''; } catch { return ''; }
        },                                                      // cliente
        () => '',                                               // servidor
    );
}
