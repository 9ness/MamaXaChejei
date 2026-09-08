'use client';

import { type ReactNode, useState } from 'react';

export interface Pestana {
    id: string;
    label: string;
    contido: ReactNode;
    /** Se pinta debajo del contenido, en pequeño. */
    pe?: ReactNode;
}

/**
 * Cambiador de sección de /lupebet. La página tenía cuatro bloques uno detrás
 * de otro y en el móvil había que hacer scroll a ciegas para llegar al último.
 * Solo se monta el bloque activo: los demás viajan en el payload pero no se
 * pintan.
 */
export function LupeBetTabs({ pestanas, inicial }: { pestanas: Pestana[]; inicial?: string }) {
    const [activa, setActiva] = useState(inicial ?? pestanas[0]?.id);
    const actual = pestanas.find((p) => p.id === activa) ?? pestanas[0];
    if (!actual) return null;

    return (
        <div>
            {/* Pegada arriba: en el móvil se cambia de sección sin volver al
                principio de la página. */}
            <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-gray-50/90 dark:bg-zinc-950/90 backdrop-blur supports-[backdrop-filter]:bg-gray-50/70">
                <div
                    role="tablist"
                    aria-label="Seccións da LupeBet"
                    className="flex gap-1.5 overflow-x-auto no-scrollbar"
                >
                    {pestanas.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            role="tab"
                            aria-selected={p.id === actual.id}
                            onClick={() => setActiva(p.id)}
                            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap border transition-colors ${
                                p.id === actual.id
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-card text-muted-foreground hover:bg-muted'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            <section role="tabpanel" className="mt-5">
                {actual.contido}
                {actual.pe}
            </section>
        </div>
    );
}
