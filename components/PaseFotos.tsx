'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { Cando } from '@/components/Cando';
import type { Foto } from '@/app/actions';

/** Canto queda cada foto na pantalla. */
const CADA_MS = 4500;
/** Menos disto non é un arrastre, é un toque. */
const ARRASTRE_MIN = 45;

/**
 * O pase de fotos: o mural a pantalla completa, pasando só. Para poñelo na
 * tele do local ou no proxector da cea da peña, ou para repasar a festa sen ir
 * abrindo foto a foto. Tocar no medio pausa; arrastrar ou as frechas (tamén as
 * do teclado) cambian de foto; Esc pecha. Mentres está aberto pídeselle ao
 * móbil que non apague a pantalla (Wake Lock, onde o haxa).
 */
export function PaseFotos({ fotos, onClose }: { fotos: Foto[]; onClose: () => void }) {
    const [idx, setIdx] = useState(0);
    const [parado, setParado] = useState(false);
    const toqueX = useRef<number | null>(null);

    const total = fotos.length;
    const ir = useCallback(
        (paso: number) => setIdx((i) => (total === 0 ? 0 : (i + paso + total) % total)),
        [total],
    );

    // O avance automático. Depende de `idx`: pasar a man reinicia a conta, que
    // se non a foto á que acabas de ir duraría só o que lle quedase á anterior.
    useEffect(() => {
        if (parado || total < 2) return;
        const t = setTimeout(() => ir(1), CADA_MS);
        return () => clearTimeout(t);
    }, [idx, parado, total, ir]);

    // A seguinte vaise baixando mentres miras esta, para que non entre en branco.
    const seguinte = total > 1 ? fotos[(idx + 1) % total].url : null;
    useEffect(() => {
        if (!seguinte) return;
        const img = new Image();
        img.src = seguinte;
    }, [seguinte]);

    useEffect(() => {
        const tecla = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight') ir(1);
            else if (e.key === 'ArrowLeft') ir(-1);
            else if (e.key === ' ') {
                e.preventDefault();
                setParado((p) => !p);
            }
        };
        window.addEventListener('keydown', tecla);
        return () => window.removeEventListener('keydown', tecla);
    }, [ir, onClose]);

    // Pantalla acesa e páxina de fondo quieta mentres dura o pase.
    useEffect(() => {
        const antes = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        let bloqueo: WakeLockSentinel | null = null;
        let vivo = true;
        const pedir = () => {
            if (document.visibilityState !== 'visible') return;
            navigator.wakeLock?.request('screen').then(
                (b) => {
                    if (vivo) bloqueo = b;
                    else b.release().catch(() => {});
                },
                () => {},   // batería baixa ou sen permiso: o pase segue igual
            );
        };
        pedir();
        // O bloqueo sóltase só ao cambiar de pestana: pídese de novo ao volver.
        document.addEventListener('visibilitychange', pedir);

        return () => {
            vivo = false;
            document.body.style.overflow = antes;
            document.removeEventListener('visibilitychange', pedir);
            bloqueo?.release().catch(() => {});
        };
    }, []);

    if (total === 0) return null;
    const foto = fotos[Math.min(idx, total - 1)];

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Pase de fotos"
            // `!mt-0`: o mural reparte os fillos con `space-y-*`, e esa marxe tamén lle
            // cae a un `fixed` (quedaba unha franxa da páxina por riba).
            className="fixed inset-0 z-[90] !mt-0 bg-black flex flex-col select-none animate-in fade-in"
            onTouchStart={(e) => { toqueX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
                if (toqueX.current === null) return;
                const dx = e.changedTouches[0].clientX - toqueX.current;
                toqueX.current = null;
                if (Math.abs(dx) >= ARRASTRE_MIN) ir(dx < 0 ? 1 : -1);
            }}
        >
            {/* A barra de arriba: canto lle queda a esta foto. A `key` reinicia a
                animación en cada cambio. */}
            <div className="h-1 bg-white/15 shrink-0">
                {total > 1 && (
                    <div
                        key={`${idx}-${parado}`}
                        className="h-full bg-white/80 mxc-pase-barra"
                        style={{ animationDuration: `${CADA_MS}ms`, animationPlayState: parado ? 'paused' : 'running' }}
                    />
                )}
            </div>

            <div className="flex items-center gap-3 px-4 py-3 text-white/80 shrink-0">
                <span className="text-sm font-semibold tabular-nums">{idx + 1} / {total}</span>
                <button
                    type="button"
                    onClick={() => setParado((p) => !p)}
                    aria-label={parado ? 'Seguir o pase' : 'Pausar o pase'}
                    className="ml-auto p-2 rounded-md hover:bg-white/10"
                >
                    {parado ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
                </button>
                <button type="button" onClick={onClose} aria-label="Pechar o pase" className="p-2 rounded-md hover:bg-white/10">
                    <X className="w-7 h-7" />
                </button>
            </div>

            <div className="relative flex-1 min-h-0 flex items-center justify-center" onClick={() => setParado((p) => !p)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    key={foto.url}
                    src={foto.url}
                    alt={foto.titulo || 'Recordo'}
                    draggable={false}
                    className="max-w-full max-h-full object-contain animate-in fade-in duration-500"
                />

                {total > 1 && (
                    <>
                        <button
                            type="button"
                            aria-label="Foto anterior"
                            onClick={(e) => { e.stopPropagation(); ir(-1); }}
                            className="absolute left-1 top-1/2 -translate-y-1/2 p-2 rounded-md text-white/70 hover:text-white hover:bg-white/10"
                        >
                            <ChevronLeft className="w-8 h-8" />
                        </button>
                        <button
                            type="button"
                            aria-label="Foto seguinte"
                            onClick={(e) => { e.stopPropagation(); ir(1); }}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-md text-white/70 hover:text-white hover:bg-white/10"
                        >
                            <ChevronRight className="w-8 h-8" />
                        </button>
                    </>
                )}
            </div>

            <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-center min-h-[3.5rem] shrink-0">
                {foto.titulo && <p className="text-base text-white/90">{foto.titulo}</p>}
                <p className="text-xs"><Cando ts={foto.ts} claro /></p>
            </div>
        </div>
    );
}
