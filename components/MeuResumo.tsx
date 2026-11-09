'use client';

import { useEffect, useState } from 'react';
import { getMinasFotos } from '@/app/actions';
import { getAnonId } from '@/lib/anon-id';

/**
 * A túa parte do resumo: cantas fotos subiches desde este móbil e cantos 🔥
 * levaron. Só o ves ti: a identidade é o `anon_id` do navegador e o mural
 * segue sendo anónimo para os demais. Se non subiches nada, non sae.
 */
export function MeuResumo({ likes }: { likes: Record<string, number> }) {
    const [minas, setMinas] = useState<string[] | null>(null);

    useEffect(() => {
        let vivo = true;
        getMinasFotos(getAnonId())
            .then((ids) => { if (vivo) setMinas(ids); })
            .catch(() => {});
        return () => { vivo = false; };
    }, []);

    if (!minas || minas.length === 0) return null;

    const lumes = minas.reduce((s, id) => s + (likes[id] ?? 0), 0);
    const mellor = minas.reduce((m, id) => Math.max(m, likes[id] ?? 0), 0);

    return (
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <h2 className="text-sm font-bold mb-1">A túa Guadalupe</h2>
            <p className="text-sm">
                Subiches <span className="font-bold">{minas.length} foto{minas.length === 1 ? '' : 's'}</span>
                {lumes > 0
                    ? <> e levaron <span className="font-bold">{lumes} 🔥</span>{minas.length > 1 && mellor > 0 ? ` (a mellor, ${mellor})` : ''}.</>
                    : '.'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Isto só o ves ti, neste móbil.</p>
        </section>
    );
}
