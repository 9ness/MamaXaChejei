import { getMembers } from '@/app/actions';
import { MemberList } from '@/components/MemberList';
import { Header } from '@/components/Header';

export const dynamic = 'force-dynamic';

export default async function ListaPage() {
    const members = await getMembers();

    return (
        <main className="min-h-screen bg-gray-50/50 dark:bg-zinc-950">
            <div className="container mx-auto py-8 px-4 max-w-5xl">
                <Header variant="compact" />

                <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs md:text-sm text-center mb-6">
                    Lista de Personas Camiseta Peña J26
                </p>

                <MemberList initialMembers={members} isAdmin={false} />
            </div>
        </main>
    );
}
