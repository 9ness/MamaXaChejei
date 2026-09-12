'use client';

import { Flame } from 'lucide-react';

/**
 * El botón del 🔥. Al encenderlo pega un salto y suelta tres llamitas hacia
 * arriba (CSS puro, en globals.css). Al apagarlo no hace nada: la fiesta es
 * darlo, no quitarlo.
 */
export function BotonLume({
    n,
    meu,
    arde,
    grande = false,
    onClick,
}: {
    n: number;
    meu: boolean;
    /** Acaba de encenderse: dispara la animación. */
    arde: boolean;
    grande?: boolean;
    onClick: () => void;
}) {
    const clase = grande
        ? `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
            meu ? 'bg-orange-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'
        }`
        : `ml-auto shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold transition-colors ${
            meu ? 'bg-orange-100 text-orange-700' : 'text-muted-foreground hover:bg-muted'
        }`;

    return (
        <span className="relative inline-flex shrink-0">
            {arde && (
                <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    {[
                        { dx: '-14px', delay: '0ms' },
                        { dx: '2px', delay: '90ms' },
                        { dx: '15px', delay: '170ms' },
                    ].map((ch, i) => (
                        <Flame
                            key={i}
                            className="absolute w-4 h-4 text-orange-500 fill-orange-400 mxc-lume"
                            style={{ ['--dx' as string]: ch.dx, animationDelay: ch.delay }}
                        />
                    ))}
                </span>
            )}

            <button
                type="button"
                aria-pressed={meu}
                aria-label={meu ? 'Quitar o teu 🔥' : 'Dar un 🔥'}
                onClick={onClick}
                className={clase}
            >
                <Flame
                    className={`${grande ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${meu ? 'fill-current' : ''} ${arde ? 'mxc-pop' : ''}`}
                />
                {(grande || n > 0) && <span className="tabular-nums">{n}</span>}
            </button>
        </span>
    );
}

