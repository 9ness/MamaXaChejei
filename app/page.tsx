import { Header } from '@/components/Header';
import { Itinerario } from '@/components/Itinerario';
import { getLugares } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Onde cae cada sitio do programa: un só HGETALL para pintar os botóns.
  const lugares = await getLugares();

  return (
    <main className="min-h-screen bg-gray-50/50 dark:bg-zinc-950">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <Header />
        <Itinerario lugares={lugares} />
      </div>
    </main>
  );
}
