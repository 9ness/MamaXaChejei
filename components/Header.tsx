import { Countdown } from '@/components/Countdown';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { SecretAdminGate } from '@/components/SecretAdminGate';
import { isAdmin, isTrustedDevice } from '@/lib/admin-auth';

interface HeaderProps {
    variant?: 'full' | 'compact';
}

export async function Header({ variant = 'full' }: HeaderProps) {
    const isCompact = variant === 'compact';
    const [admin, trusted] = await Promise.all([isAdmin(), isTrustedDevice()]);

    return (
        <header className={isCompact ? "mb-6 text-center space-y-2" : "mb-10 text-center space-y-4"}>
            <div className="space-y-1">
                {/* 5 toques en el título = interruptor del modo admin (ver SecretAdminGate) */}
                <SecretAdminGate isAdmin={admin} trusted={trusted}>
                    <h1 className={`${isCompact ? "text-3xl md:text-4xl" : "text-5xl md:text-7xl"} font-extrabold tracking-tight bg-gradient-to-r from-[hsl(var(--pena-from))] to-[hsl(var(--pena-to))] bg-clip-text text-transparent drop-shadow-sm`}>
                        MAMA XA CHEJEI
                    </h1>
                </SecretAdminGate>
                <h2 className={`${isCompact ? "text-lg md:text-xl" : "text-2xl md:text-3xl"} font-serif italic text-slate-600 dark:text-slate-300 font-light tracking-wide`}>
                    Guadalupe 2026
                </h2>
            </div>

            {!isCompact && (
                <div className="py-4">
                    <Countdown />
                </div>
            )}

            <div className="mb-4">
                <AnnouncementBanner />
            </div>
        </header>
    );
}
