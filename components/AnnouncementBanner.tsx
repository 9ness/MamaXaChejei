import { getAnnouncement } from '@/app/actions';
import { Megaphone } from 'lucide-react';

export async function AnnouncementBanner() {
    const text = await getAnnouncement();

    if (!text) return null;

    return (
        <div className="relative max-w-2xl mx-auto animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 shadow-[0_8px_30px_-12px_rgba(245,158,11,0.4)]">
                {/* brillo decorativo */}
                <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl" />

                <div className="relative flex items-center gap-4 p-4 sm:p-5 text-left">
                    <div className="shrink-0 grid place-items-center h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md">
                        <Megaphone className="h-6 w-6 text-white animate-[pulse_2s_ease-in-out_infinite]" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-orange-600/90 mb-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                            Aviso da peña
                        </span>
                        <p className="text-[15px] sm:text-base font-semibold leading-snug text-amber-950 whitespace-pre-wrap break-words">
                            {String(text)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
