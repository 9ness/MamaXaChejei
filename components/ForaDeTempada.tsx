'use client';

import Link from 'next/link';
import { BarChart3, Images } from 'lucide-react';
import { useNow } from '@/lib/use-now';
import { ANO_FESTA, diasAta, faseDaFesta, proximaGuadalupe } from '@/lib/festas';

/**
 * A portada cando a Guadalupe xa pasou. De setembro a setembro a app quedaba
 * co programa enteiro en gris e sen conta atrás: aquí vai o que si ten sentido
 * mirar fóra de tempada (o resumo e as fotos) e canto falta para a seguinte.
 * Antes e durante a festa non pinta nada.
 */
export function ForaDeTempada() {
    // null no servidor e na hidratación, coma o resto dos reloxos da portada.
    const now = useNow(60_000);
    if (now === null || faseDaFesta(now) !== 'despois') return null;

    const proxima = proximaGuadalupe(now);
    const dias = diasAta(proxima.inicio, now);

    return (
        <section className="max-w-xl mx-auto rounded-lg border bg-card shadow-sm p-5 text-center">
            <p className="text-sm text-muted-foreground">A Guadalupe {ANO_FESTA} xa é historia</p>

            {dias > 0 && (
                <>
                    <p className="mt-2 text-5xl font-black tabular-nums text-primary leading-none">{dias}</p>
                    <p className="mt-1 text-sm font-semibold">
                        día{dias === 1 ? '' : 's'} para a Guadalupe {proxima.ano}
                    </p>
                    {proxima.estimada && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                            Data aproximada: venres {proxima.dia} de setembro, ata que saia o cartel.
                        </p>
                    )}
                </>
            )}

            <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link
                    href="/resumo"
                    className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-sm active:scale-95 transition-transform"
                >
                    <BarChart3 className="w-4 h-4" /> A festa en cifras
                </Link>
                <Link
                    href="/recuerdos"
                    className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-semibold shadow-sm active:scale-95 transition-transform"
                >
                    <Images className="w-4 h-4" /> Fotos e cancións
                </Link>
            </div>
        </section>
    );
}
