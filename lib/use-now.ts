'use client';

import { useSyncExternalStore } from 'react';

/**
 * A hora actual, refrescada cada `cadaMs`, como un dato externo máis.
 *
 * Devolve `null` no servidor e na hidratación: así o HTML do servidor (Vercel
 * vai en UTC) e o primeiro render do móbil coinciden, e quen o usa pinta o seu
 * "aínda non sei a hora" ata o seguinte render. Substitúe o vello
 * `useEffect(() => { setNow(Date.now()) })`, que o lint de React 19 marca
 * (`set-state-in-effect`) e que facía un render en cascada ao montar.
 *
 * O valor redondéase a `cadaMs` para que dúas lecturas seguidas devolvan o
 * mesmo número: useSyncExternalStore re-renderiza en bucle se o snapshot
 * cambia en cada chamada.
 */
export function useNow(cadaMs: number): number | null {
    return useSyncExternalStore(
        (avisar) => {
            const t = setInterval(avisar, cadaMs);
            return () => clearInterval(t);
        },
        () => redondear(Date.now(), cadaMs),
        () => null,
    );
}

export function redondear(ms: number, cadaMs: number): number {
    return Math.floor(ms / cadaMs) * cadaMs;
}
