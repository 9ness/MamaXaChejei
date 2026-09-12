'use client';

import { useState } from 'react';
import { FotosClient } from '@/components/FotosClient';
import { AudiosClient } from '@/components/AudiosClient';
import type { AudioPena, Foto } from '@/app/actions';
import { cn } from '@/lib/utils';

/**
 * Fotos e audios comparten sección en vez de pestana propia no menú: a barra de
 * abaixo xa vai con catro (seis en admin) e unha máis non entra nun móbil.
 * Mándanse os dous conxuntos de datos xa lidos en servidor; o que non se vexa
 * non custa nada, xa está na páxina.
 */
export function RecuerdosTabs({
    fotos,
    likes,
    audios,
    isAdmin = false,
}: {
    fotos: Foto[];
    likes: Record<string, number>;
    audios: AudioPena[];
    isAdmin?: boolean;
}) {
    const [tab, setTab] = useState<'fotos' | 'audios'>('fotos');

    const boton = (id: 'fotos' | 'audios', etiqueta: string, n: number) => (
        <button
            type="button"
            onClick={() => setTab(id)}
            className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                tab === id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted",
            )}
        >
            {etiqueta}
            {n > 0 && (
                <span className={cn("ml-1.5 text-xs font-bold", tab === id ? "opacity-80" : "opacity-60")}>
                    {n}
                </span>
            )}
        </button>
    );

    return (
        <div className="space-y-5">
            <div className="flex gap-1 bg-muted/60 border rounded-xl p-1 max-w-xs mx-auto">
                {boton('fotos', '📸 Fotos', fotos.length)}
                {boton('audios', '🎵 Audios', audios.length)}
            </div>

            {tab === 'fotos'
                ? <FotosClient initialFotos={fotos} initialLikes={likes} isAdmin={isAdmin} />
                : <AudiosClient initialAudios={audios} isAdmin={isAdmin} />}
        </div>
    );
}
