import { getMembers, getPenaColor } from '@/app/actions';
import { MemberList } from '@/components/MemberList';
import { LoginForm } from '@/components/LoginForm';
import { AnnouncementForm } from '@/components/AnnouncementForm';
import { isAdmin } from '@/lib/admin-auth';
import { Button } from '@/components/ui/button';
import { logout } from '@/app/admin/actions';
import { BulkUpload, DangerZone } from '@/components/AdminControls';
import { AddMemberForm } from '@/components/AddMemberForm';
import { SeccionAdmin } from '@/components/SeccionAdmin';
import { PenaColorPicker } from '@/components/PenaColorPicker';
import { Header } from '@/components/Header';
import { ChangePinForm } from '@/components/ChangePinForm';
import { isPinSet } from '@/lib/admin-pin';

export const dynamic = 'force-dynamic';

export default async function GestionPage() {
    const hasPin = await isPinSet();

    if (!(await isAdmin())) {
        return <LoginForm hasPin={hasPin} />;
    }

    const members = await getMembers();
    const penaColor = await getPenaColor();

    return (
        <main className="min-h-screen bg-muted/10 pb-10 relative">
            <div className="absolute top-0 right-0 m-2 z-50">
                <span className="bg-amber-100/80 backdrop-blur border border-amber-200 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                    🛡️ ADMIN
                </span>
            </div>

            <div className="container mx-auto py-8 px-4 max-w-6xl">
                <Header variant="compact" />

                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                    <div className="text-center md:text-left">
                        <h1 className="text-xl font-bold tracking-tight">Gestión de Camisetas</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <AnnouncementForm />
                        <form action={logout}>
                            <Button variant="outline" size="sm">Salir</Button>
                        </form>
                    </div>
                </div>

                {/* Arriba lo que se usa: dar de alta y la lista. Los ajustes que
                    casi nunca se tocan van plegados y al final. */}
                <div className="space-y-4">
                    <AddMemberForm />

                    <SeccionAdmin titulo="Pegar la lista completa" pista="carga rápida">
                        <BulkUpload />
                    </SeccionAdmin>
                </div>

                <div className="bg-background rounded-lg border shadow-sm p-4 mt-6">
                    <MemberList initialMembers={members} isAdmin={true} />
                </div>

                <div className="mt-8 space-y-3">
                    <SeccionAdmin titulo="🎨 Color de la peña" pista="tiñe toda la web">
                        <PenaColorPicker current={penaColor} />
                    </SeccionAdmin>

                    <SeccionAdmin titulo={hasPin ? '🔑 Cambiar PIN' : '🔑 Poner un PIN'} pista="acceso de admin">
                        <ChangePinForm hasPin={hasPin} />
                    </SeccionAdmin>

                    <DangerZone />
                </div>

            </div>
        </main>
    );
}
