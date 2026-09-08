import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { BoletoTicket } from '@/components/BoletoTicket';
import { BoletoForm } from '@/components/BoletoForm';
import { BoletoList } from '@/components/BoletoList';
import { getBoletos, getRankingMoedas } from '@/app/actions';
import { isAdmin } from '@/lib/admin-auth';
import { BOLETO_OFICIAL } from '@/lib/lupebet';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
    title: 'LupeBet · Juadalupe 26',
    description: 'O boleto da camiseta e os pronósticos da peña.',
};

export default async function LupeBetPage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams;
    // Compatibilidad con los enlaces viejos /lupebet?b=<id>, que ahora viven en
    // /lupebet/<id>.
    if (typeof sp.b === 'string' && sp.b) redirect(`/lupebet/${encodeURIComponent(sp.b)}`);

    const [boletos, admin, ranking] = await Promise.all([
        getBoletos(),
        isAdmin(),
        getRankingMoedas(),
    ]);

    return (
        <main className="min-h-screen bg-gray-50/50 dark:bg-zinc-950">
            <div className="container mx-auto py-8 px-4 max-w-3xl">
                <Header variant="compact" />

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
                        🎟️ LupeBet
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        O boleto da camiseta e os pronósticos de broma da peña.
                    </p>
                </div>

                <section className="mb-12">
                    <h2 className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                        O boleto oficial · o da camiseta
                    </h2>
                    <BoletoTicket
                        titulo={BOLETO_OFICIAL.titulo}
                        idBoleto={BOLETO_OFICIAL.idBoleto}
                        codigo={BOLETO_OFICIAL.codigo}
                        fecha={BOLETO_OFICIAL.fecha}
                        estado={BOLETO_OFICIAL.estado}
                        lineas={[...BOLETO_OFICIAL.lineas]}
                        importe={BOLETO_OFICIAL.importe}
                        cuotaTotal={BOLETO_OFICIAL.cuotaTotal}
                        ganancia={BOLETO_OFICIAL.ganancia}
                    />
                </section>

                {/* <details> nativo: abre el formulario sin cargar la página de golpe. */}
                <details className="mb-12 group">
                    <summary className="cursor-pointer list-none rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-5 text-center font-bold hover:bg-primary/10 transition-colors">
                        ✍️ Fai o teu boleto
                        <span className="block text-xs font-normal text-muted-foreground mt-1">
                            As túas liñas, as túas cuotas. Só por xogar.
                        </span>
                    </summary>
                    <div className="mt-4">
                        <BoletoForm />
                    </div>
                </details>

                <section className="mb-12">
                    <h2 className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                        Os boletos da peña
                    </h2>
                    <BoletoList boletos={boletos} isAdmin={admin} />
                </section>

                {ranking.length > 0 && (
                    <section>
                        <h2 className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                            🪙 Clasificación de moedas
                        </h2>
                        <ol className="rounded-lg border bg-card divide-y">
                            {ranking.map((p, i) => (
                                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                                    <span className="w-6 text-sm font-bold text-muted-foreground tabular-nums">
                                        {i + 1}
                                    </span>
                                    <span className="flex-1 truncate font-medium">{p.nombre}</span>
                                    <span className="font-bold tabular-nums">{p.saldo}</span>
                                </li>
                            ))}
                        </ol>
                        <p className="text-center text-[11px] text-muted-foreground mt-2">
                            Cada móbil empeza con 1000 moedas. Son de broma, non serven para nada. 🎈
                        </p>
                    </section>
                )}
            </div>
        </main>
    );
}
