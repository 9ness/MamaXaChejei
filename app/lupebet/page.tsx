import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { BoletoTicket } from '@/components/BoletoTicket';
import { BoletoForm } from '@/components/BoletoForm';
import { BoletoList } from '@/components/BoletoList';
import { BoletosDestacados } from '@/components/BoletosDestacados';
import { LupeBetTabs, type Pestana } from '@/components/LupeBetTabs';
import { LupeBetUser } from '@/components/LupeBetUser';
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

    const destacados = boletos.filter((b) => b.destacado);

    // Tres pestañas y no más: tienen que caber enteras en la pantalla del móvil
    // sin arrastrar. Los destacados no son una sección aparte, van arriba de los
    // boletos, que es donde se buscan.
    const pestanas: Pestana[] = [
        {
            id: 'boletos',
            label: '🎟️ Boletos',
            contido: (
                <div className="space-y-8">
                    {destacados.length > 0 && (
                        <div>
                            <h2 className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                ⭐ Os pronósticos da peña
                            </h2>
                            <BoletosDestacados boletos={destacados} isAdmin={admin} />
                            <p className="text-center text-[11px] text-muted-foreground mt-2">
                                Os que escolleu a organización. Métete a favor ou en contra. 👀
                            </p>
                        </div>
                    )}

                    <div>
                        {destacados.length > 0 && (
                            <h2 className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                Todos os boletos
                            </h2>
                        )}
                        <BoletoList boletos={boletos} isAdmin={admin} />
                    </div>
                </div>
            ),
            pe: admin ? (
                <p className="text-center text-[11px] text-muted-foreground mt-3">
                    🛡️ Toca a ⭐ dun boleto para subilo aos pronósticos da peña.
                </p>
            ) : null,
        },
        {
            id: 'oficial',
            label: '👕 Boleto camiseta',
            contido: (
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
            ),
        },
        {
            id: 'ranking',
            label: '🪙 Clasificación',
            contido: ranking.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                    Aínda non hai ninguén na clasificación. Ponte un nome aí arriba e
                    aposta nun boleto. 🪙
                </p>
            ) : (
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
            ),
            pe: (
                <p className="text-center text-[11px] text-muted-foreground mt-3">
                    Cada móbil empeza con 1000 moedas. Son de broma, non serven para nada. 🎈
                </p>
            ),
        },
    ];

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

                {/* Quen es e cantas moedas tes: o primeiro que se mira ao entrar. */}
                <LupeBetUser />

                {/* Lo primero de la página: si esto queda abajo, nadie se entera de
                    que puede hacer el suyo. <details> nativo, para no cargar el
                    formulario entero de entrada. */}
                <details className="mb-10 group">
                    <summary className="cursor-pointer list-none rounded-xl bg-primary text-primary-foreground px-4 py-4 text-center font-bold shadow-sm hover:brightness-105 transition-all">
                        ✍️ Fai o teu boleto
                        <span className="block text-xs font-normal opacity-90 mt-1">
                            As túas liñas, as túas cuotas. Só por xogar.
                        </span>
                    </summary>
                    <div className="mt-4">
                        <BoletoForm />
                    </div>
                </details>

                <LupeBetTabs pestanas={pestanas} inicial={pestanas[0]?.id} />
            </div>
        </main>
    );
}
