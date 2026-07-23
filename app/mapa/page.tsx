import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Header } from '@/components/Header';
import { MapaClient } from '@/components/MapaClient';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Cuando se comparte /mapa?p=lat,lng por WhatsApp, generamos una tarjeta con
// miniatura del mapa (og:image) para que el enlace se vea chulo.
export async function generateMetadata(
    { searchParams }: { searchParams: SearchParams },
): Promise<Metadata> {
    const sp = await searchParams;
    const p = typeof sp.p === 'string' ? sp.p : undefined;
    const n = typeof sp.n === 'string' ? sp.n : undefined;
    const c = typeof sp.c === 'string' ? sp.c : undefined;

    if (!p) {
        return {
            title: 'Mapa da festa',
            description: 'Comparte a túa ubicación para atoparvos na festa.',
        };
    }

    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
    const proto = h.get('x-forwarded-proto') ?? 'https';
    const base = host ? `${proto}://${host}` : '';

    const qs = new URLSearchParams({ p });
    if (n) qs.set('n', n);
    if (c) qs.set('c', c);
    const ogUrl = `${base}/api/og/mapa?${qs.toString()}`;

    const who = n ? `${n} está aquí 📍` : 'Estou aquí 📍';
    return {
        title: `${who} · Festa da Guadalupe`,
        description: 'Mira a ubicación no mapa da festa da peña.',
        openGraph: {
            title: who,
            description: 'Ubicación compartida no mapa da festa da peña.',
            images: [{ url: ogUrl, width: 1200, height: 630 }],
        },
        twitter: {
            card: 'summary_large_image',
            title: who,
            images: [ogUrl],
        },
    };
}

export default function MapaPage() {
    return (
        <main className="min-h-screen bg-gray-50/50 dark:bg-zinc-950">
            <div className="container mx-auto py-8 px-4 max-w-3xl">
                <Header variant="compact" />

                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
                        🗺️ Mapa da festa
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Praza de Castelao (Rianxo) · comparte a túa ubicación para atoparvos.
                    </p>
                </div>

                <MapaClient />
            </div>
        </main>
    );
}
