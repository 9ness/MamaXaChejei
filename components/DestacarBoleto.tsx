'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { destacarBoleto } from '@/app/actions';

/** Estrella de admin: sube o baja un boleto de "Os pronósticos da peña".
 *  Se puede quitar sin miedo, no borra nada ni toca las apuestas. */
export function DestacarBoleto({
    boletoId,
    destacado,
    className = '',
}: {
    boletoId: string;
    destacado: boolean;
    className?: string;
}) {
    const router = useRouter();
    const [marcado, setMarcado] = useState(destacado);
    const [pending, setPending] = useState(false);

    const alternar = async () => {
        const siguiente = !marcado;
        setMarcado(siguiente); // optimista: la estrella responde al momento
        setPending(true);
        const res = await destacarBoleto(boletoId, siguiente);
        setPending(false);
        if (res?.error) {
            setMarcado(!siguiente);
            return;
        }
        router.refresh();
    };

    return (
        <button
            type="button"
            disabled={pending}
            aria-pressed={marcado}
            aria-label={marcado ? 'Quitar dos destacados' : 'Destacar este pronóstico'}
            title={marcado ? 'Quitar dos destacados' : 'Destacar este pronóstico'}
            onClick={alternar}
            className={`p-1.5 rounded-md transition-colors disabled:opacity-50 ${
                marcado
                    ? 'text-amber-500 hover:bg-amber-50'
                    : 'text-muted-foreground hover:text-amber-500 hover:bg-amber-50'
            } ${className}`}
        >
            <Star className={`w-4 h-4 ${marcado ? 'fill-current' : ''}`} />
        </button>
    );
}
