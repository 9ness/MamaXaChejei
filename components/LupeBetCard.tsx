import Link from 'next/link';
import { BOLETO_OFICIAL, LUPE_AZUL, eur } from '@/lib/lupebet';

/** Bloque de la portada que lleva a /lupebet. Con los colores de la camiseta. */
export function LupeBetCard() {
    return (
        <Link
            href="/lupebet"
            className="block mt-10 rounded-2xl overflow-hidden bg-white shadow-md hover:shadow-xl transition-shadow ring-1 ring-black/5"
            style={{ color: LUPE_AZUL }}
        >
            <div className="px-5 py-4 text-white" style={{ background: LUPE_AZUL }}>
                <div className="flex items-baseline justify-between gap-3">
                    <p className="text-3xl font-extrabold italic tracking-tight leading-none">LupeBet</p>
                    <p className="text-xs font-bold tracking-widest whitespace-nowrap">JUADALUPE&rsquo;26</p>
                </div>
            </div>

            <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                    <span className="block text-[11px] font-bold uppercase tracking-wide opacity-70">
                        {BOLETO_OFICIAL.lineas.length} liñas · Cuota {eur(BOLETO_OFICIAL.cuotaTotal)}
                    </span>
                    <span className="block text-sm font-bold mt-0.5">Mira o boleto e fai o teu</span>
                </div>
                <span className="text-2xl font-extrabold tabular-nums shrink-0">
                    {eur(BOLETO_OFICIAL.ganancia)}€
                </span>
            </div>
        </Link>
    );
}
