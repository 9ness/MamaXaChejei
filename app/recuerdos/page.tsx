import { Header } from '@/components/Header';
import { RecuerdosTabs } from '@/components/RecuerdosTabs';
import { getAudios, getFotos, getLikes } from '@/app/actions';
import { isAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function RecuerdosPage() {
    const [fotos, likes, audios, admin] = await Promise.all([
        getFotos(), getLikes(), getAudios(), isAdmin(),
    ]);

    return (
        <main className="min-h-screen bg-gray-50/50 dark:bg-zinc-950">
            <div className="container mx-auto py-8 px-4 max-w-5xl">
                <Header variant="compact" />

                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
                        📸 Recordos
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        O mural da peña. Sube as túas fotos e as cancións que saian.
                    </p>
                </div>

                <RecuerdosTabs fotos={fotos} likes={likes} audios={audios} isAdmin={admin} />
            </div>
        </main>
    );
}
