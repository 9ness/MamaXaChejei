import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Header } from '@/components/Header';
import { BoletoTicket } from '@/components/BoletoTicket';
import { BoletoForm } from '@/components/BoletoForm';
import { BoletoList } from '@/components/BoletoList';
import { BoletoShare } from '@/components/BoletoShare';
import { getBoleto, getBoletos } from '@/app/actions';
import { isAdmin } from '@/lib/admin-auth';
import { BOLETO_OFICIAL } from '@/lib/lupebet';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Al compartir /lupebet?b=<id> por WhatsApp, la miniatura es el propio ticket.
export async function generateMetadata(
    { searchParams }: { searchParams: SearchParams },
): Promise<Metadata> {
    const sp = await searchParams;
    const id = typeof sp.b === 'string' ? sp.b : undefined;
    const boleto = id ? await getBoleto(id) : null;

    if (!boleto) {
        return {
            title: 'LupeBet · Juadalupe 26',
            description: 'O boleto da camiseta e os pronósticos da peña.',
        };
    }

    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
    const proto = h.get('x-forwarded-proto') ?? 'https';
    const ogUrl = `${host ? `${proto}://${host}` : ''}/api/og/lupebet?b=${encodeURIComponent(boleto.id)}`;

    const titulo = `O boleto de ${boleto.nombre} 🎟️`;
    return {
        title: `${titulo} · LupeBet`,
        description: `${boleto.lineas.length} liñas na LupeBet da Juadalupe 26.`,
        openGraph: {
            title: titulo,
            description: `${boleto.lineas.length} liñas · Juadalupe 26`,
            images: [{ url: ogUrl, width: 1200, height: 630 }],
        },
        twitter: { card: 'summary_large_image', title: titulo, images: [ogUrl] },
    };
}

export default async function LupeBetPage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams;
    const id = typeof sp.b === 'string' ? sp.b : undefined;

    const [destacado, boletos, admin] = await Promise.all([
        id ? getBoleto(id) : Promise.resolve(null),
        getBoletos(),
        isAdmin(),
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

                {destacado && (
                    <section className="mb-12">
                        <h2 className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                            O boleto de {destacado.nombre}
                        </h2>
                        <BoletoTicket
                            titulo={destacado.titulo}
                            idBoleto={destacado.id}
                            codigo={destacado.codigo}
                            fecha={destacado.fecha}
                            lineas={destacado.lineas}
                            importe={destacado.importe}
                            nombre={destacado.nombre}
                        />
                        <div className="flex justify-center mt-4">
                            <BoletoShare id={destacado.id} nombre={destacado.nombre} />
                        </div>
                    </section>
                )}

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

                <section>
                    <h2 className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                        Os boletos da peña
                    </h2>
                    <BoletoList boletos={boletos} isAdmin={admin} />
                </section>
            </div>
        </main>
    );
}
