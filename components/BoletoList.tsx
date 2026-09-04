'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { type Boleto, cuotaTotal, eur, ganancia } from '@/lib/lupebet';
import { deleteBoleto } from '@/app/actions';

/** Lista compacta: el ticket entero solo se pinta al abrir uno, si no la página
 *  se hace eterna con 50 boletos. */
export function BoletoList({ boletos, isAdmin = false }: { boletos: Boleto[]; isAdmin?: boolean }) {
    const [borrados, setBorrados] = useState<string[]>([]);
    const visibles = boletos.filter((b) => !borrados.includes(b.id));

    if (visibles.length === 0) {
        return (
            <p className="text-sm text-muted-foreground text-center py-6">
                Aínda non hai ningún boleto. Fai o primeiro. 👆
            </p>
        );
    }

    const handleDelete = async (id: string) => {
        setBorrados((prev) => [...prev, id]);
        const res = await deleteBoleto(id);
        if (res?.error) setBorrados((prev) => prev.filter((x) => x !== id));
    };

    return (
        <ul className="grid gap-3 sm:grid-cols-2">
            {visibles.map((b) => (
                <li key={b.id} className="relative">
                    <Link
                        href={`/lupebet?b=${encodeURIComponent(b.id)}`}
                        className="block border rounded-lg p-4 bg-card hover:border-primary transition-colors h-full"
                    >
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="font-bold truncate">{b.nombre}</span>
                            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                                {b.lineas.length} liña{b.lineas.length === 1 ? '' : 's'}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide truncate mt-0.5">
                            {b.titulo}
                        </p>
                        <div className="mt-3 flex items-end justify-between gap-3">
                            <span className="text-[11px] text-muted-foreground">
                                Cuota {eur(cuotaTotal(b.lineas))}
                            </span>
                            <span className="text-xl font-extrabold tabular-nums">
                                {eur(ganancia(b.importe, b.lineas))}€
                            </span>
                        </div>
                    </Link>

                    {isAdmin && (
                        <button
                            type="button"
                            aria-label={`Borrar o boleto de ${b.nombre}`}
                            onClick={() => handleDelete(b.id)}
                            className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </li>
            ))}
        </ul>
    );
}
