import { Header } from '@/components/Header';
import { Itinerario } from '@/components/Itinerario';
import { LupeBetCard } from '@/components/LupeBetCard';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50/50 dark:bg-zinc-950">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <Header />
        <Itinerario />
        <LupeBetCard />
      </div>
    </main>
  );
}
