'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

/**
 * Comparte a páxina na que estás: a folla de compartir do móbil se a hai e,
 * se non (escritorio), copia a ligazón. Sen `await` antes de `share()`: ten
 * que saír do propio toque ou Safari rexéitao.
 */
export function BotonCompartir({ titulo, texto }: { titulo: string; texto: string }) {
    const [copiado, setCopiado] = useState(false);

    const compartir = () => {
        const url = window.location.href;
        if (typeof navigator.share === 'function') {
            // Se a persoa pecha a folla sen compartir, non é un erro.
            navigator.share({ title: titulo, text: texto, url }).catch(() => {});
            return;
        }
        navigator.clipboard?.writeText(`${texto} ${url}`).then(
            () => {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
            },
            () => {},
        );
    };

    return (
        <button
            type="button"
            onClick={compartir}
            className="inline-flex items-center gap-2 rounded-md border bg-card px-4 py-2 text-sm font-semibold shadow-sm active:scale-95 transition-transform"
        >
            {copiado ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {copiado ? 'Ligazón copiada' : 'Compartir'}
        </button>
    );
}
