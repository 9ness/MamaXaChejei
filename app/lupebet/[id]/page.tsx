import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Header } from '@/components/Header';
import { BoletoTicket } from '@/components/BoletoTicket';
import { BoletoShare } from '@/components/BoletoShare';
import { ApostarPanel } from '@/components/ApostarPanel';
import { ResolverBoleto } from '@/components/ResolverBoleto';
import { DestacarBoleto } from '@/components/DestacarBoleto';
import { getApostas, getBoleto } from '@/app/actions';
import { isAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

// Cada boleto tiene su URL propia: /lupebet/LB-080926-123456. Compartirla lleva
// directamente a la ficha, y la miniatura del enlace es el propio ticket.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { id } = await params;
    const boleto = await getBoleto(decodeURIComponent(id));

    if (!boleto) return { title: 'Boleto non atopado · LupeBet' };

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

export default async function BoletoPage({ params }: { params: Params }) {
    const { id } = await params;
    const boleto = await getBoleto(decodeURIComponent(id));
    if (!boleto) notFound();

    const [apostas, admin] = await Promise.all([getApostas(boleto.id), isAdmin()]);

    return (
        <main className="min-h-screen bg-gray-50/50 dark:bg-zinc-950">
            <div className="container mx-auto py-8 px-4 max-w-3xl">
                <Header variant="compact" />

                <Link
                    href="/lupebet"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" /> Todos os boletos
                </Link>

                <BoletoTicket
                    titulo={boleto.titulo}
                    idBoleto={boleto.id}
                    codigo={boleto.codigo}
                    fecha={boleto.fecha}
                    lineas={boleto.lineas}
                    importe={boleto.importe}
                    nombre={boleto.nombre}
                    estado={
                        boleto.estado === 'ganado' ? 'Gañado'
                            : boleto.estado === 'perdido' ? 'Perdido'
                                : 'Aceptada'
                    }
                />

                <div className="max-w-md mx-auto">
                    <div className="flex justify-center mt-4">
                        <BoletoShare id={boleto.id} nombre={boleto.nombre} />
                    </div>

                    <ApostarPanel
                        boletoId={boleto.id}
                        estado={boleto.estado ?? 'aberto'}
                        lineas={boleto.lineas}
                        apostas={apostas}
                    />

                    {admin && (
                        <div className="mt-4 rounded-lg border border-dashed p-3 flex items-center justify-between gap-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                {boleto.destacado ? '⭐ Está nos pronósticos da peña' : 'Destacar nos pronósticos da peña'}
                            </p>
                            <DestacarBoleto boletoId={boleto.id} destacado={Boolean(boleto.destacado)} />
                        </div>
                    )}

                    {admin && (boleto.estado ?? 'aberto') === 'aberto' && (
                        <ResolverBoleto boletoId={boleto.id} />
                    )}
                </div>
            </div>
        </main>
    );
}
