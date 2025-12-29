import { getMembers } from '@/app/actions';
import { MemberList } from '@/components/MemberList';
import { LoginForm } from '@/components/LoginForm';
import { AnnouncementForm } from '@/components/AnnouncementForm';
import { cookies } from 'next/headers';
import { Button } from '@/components/ui/button';
import { logout } from '@/app/admin/actions';
import { AdminControls } from '@/components/AdminControls';
import { Header } from '@/components/Header';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
    const cookieStore = await cookies();
    const isAuthenticated = cookieStore.get('auth')?.value === 'true';

    if (!isAuthenticated) {
        return <LoginForm />;
    }

    const members = await getMembers();

    return (
        <main className="min-h-screen bg-muted/10 pb-10 relative">
            <div className="absolute top-0 right-0 m-2 z-50">
                <span className="bg-amber-100/80 backdrop-blur border border-amber-200 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                    🛡️ ADMIN
                </span>
            </div>

            <div className="container mx-auto py-8 px-4 max-w-6xl">
                <Header />

                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                    <div className="text-center md:text-left">
                        <h1 className="text-xl font-bold tracking-tight">Panel de Control</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <AnnouncementForm />
                        <form action={logout}>
                            <Button variant="outline" size="sm">Salir</Button>
                        </form>
                    </div>
                </div>

                <div className="bg-background rounded-lg border shadow-sm p-4">
                    <MemberList initialMembers={members} isAdmin={true} />
                </div>

                <AdminControls />
            </div>
        </main>
    );
}
