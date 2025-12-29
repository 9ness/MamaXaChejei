import { Countdown } from '@/components/Countdown';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';

export function Header() {
    return (
        <header className="mb-10 text-center space-y-4">
            <div className="space-y-1">
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent drop-shadow-sm">
                    MAMA XA CHEJEI
                </h1>
                <h2 className="text-2xl md:text-3xl font-serif italic text-slate-600 dark:text-slate-300 font-light tracking-wide">
                    Guadalupe 2026
                </h2>
            </div>

            <div className="py-4">
                <Countdown />
            </div>

            <div className="mb-8">
                <AnnouncementBanner />
            </div>

            <p className="text-muted-foreground font-medium text-lg uppercase tracking-widest text-xs md:text-sm mt-8 mb-2">
                Lista de Personas Camiseta Peña J26
            </p>
        </header>
    );
}
