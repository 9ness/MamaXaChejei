import Link from 'next/link';
import { Star } from 'lucide-react';
import { type Boleto, eur, mercadoBoleto } from '@/lib/lupebet';
import { DestacarBoleto } from '@/components/DestacarBoleto';

/**
 * Los pronósticos que el admin ha subido arriba. Aquí no se enseña el ticket
 * entero: se leen las líneas de un vistazo, que es de lo que se ríe la peña.
 */
export function BoletosDestacados({ boletos, isAdmin = false }: { boletos: Boleto[]; isAdmin?: boolean }) {
    if (boletos.length === 0) return null;

    return (
        <ul className="grid gap-3">
            {boletos.map((b) => {
                const mercado = mercadoBoleto(b.lineas, 0, 0);
                const pechado = (b.estado ?? 'aberto') !== 'aberto';

                return (
                    <li
                        key={b.id}
                        className="relative rounded-xl border-2 border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 p-4"
                    >
                        <div className="flex items-baseline justify-between gap-3 pr-7">
                            <span className="font-bold truncate">
                                <Star className="inline w-3.5 h-3.5 mb-0.5 mr-1 text-amber-500 fill-current" />
                                {b.nombre}
                            </span>
                            <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                                Cuota ×{eur(mercado.baseSi)}
                            </span>
                        </div>

                        <ul className="mt-2 space-y-1">
                            {b.lineas.map((l, i) => (
                                <li key={i} className="text-sm leading-snug">
                                    <span className="font-medium">{l.apuesta}</span>{' '}
                                    <span className="text-muted-foreground">→ {l.pronostico}</span>{' '}
                                    <span className="text-xs font-bold tabular-nums">{eur(l.cuota)}</span>
                                </li>
                            ))}
                        </ul>

                        <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                                {pechado
                                    ? b.estado === 'ganado' ? '🎉 Saíu gañado' : '💀 Saíu perdido'
                                    : `🪙 ${b.apostado ?? 0} moedas · ${b.apostantes ?? 0} ${b.apostantes === 1 ? 'persoa' : 'persoas'}`}
                            </span>
                            <Link
                                href={`/lupebet/${encodeURIComponent(b.id)}`}
                                className="text-xs font-bold text-primary hover:underline"
                            >
                                {pechado ? 'Ver o boleto' : 'Apostar →'}
                            </Link>
                        </div>

                        {isAdmin && (
                            <DestacarBoleto
                                boletoId={b.id}
                                destacado
                                className="absolute top-2 right-2"
                            />
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
