import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { ResumoVista } from '@/components/ResumoVista';
import {
    getAudios, getAvisos, getBoletos, getFotos, getLikes, getLikesAudios,
    getRankingMoedas, getRankingXogo, getTotalGames,
} from '@/app/actions';
import { ANO_FESTA } from '@/lib/festas';
import { calcularResumo } from '@/lib/resumo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: `A Guadalupe ${ANO_FESTA} en cifras`,
    description: 'O que deixou a festa: fotos, lumes, cancións, xogo e LupeBet.',
};

export default async function ResumoPage() {
    // Todo lecturas que xa existían (as mesmas de Recordos e LupeBet): aquí non
    // se toca ningunha key nova de Redis.
    const [fotos, likes, audios, likesAudios, boletos, xogo, moedas, avisos, partidas] = await Promise.all([
        getFotos(), getLikes(), getAudios(), getLikesAudios(), getBoletos(),
        getRankingXogo(3), getRankingMoedas(3), getAvisos(), getTotalGames(),
    ]);

    const r = calcularResumo({
        fotos, likes, audios, likesAudios, boletos, xogo, moedas,
        mensaxes: avisos.chatN, partidas,
    });

    return (
        <main className="min-h-screen bg-gray-50/50 dark:bg-zinc-950">
            <div className="container mx-auto py-8 px-4 max-w-xl">
                <Header variant="compact" />

                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold">A Guadalupe {ANO_FESTA} en cifras</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        O que deixou a festa, contado polo que subiu a peña.
                    </p>
                </div>

                <ResumoVista r={r} likes={likes} />
            </div>
        </main>
    );
}
