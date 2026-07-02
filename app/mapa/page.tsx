import { Header } from '@/components/Header';
import { MapaClient } from '@/components/MapaClient';

export const dynamic = 'force-dynamic';

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
                        Comparte a túa ubicación para atoparvos na festa.
                    </p>
                </div>

                <MapaClient />
            </div>
        </main>
    );
}
