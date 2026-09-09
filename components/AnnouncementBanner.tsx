import { getAnnouncement } from '@/app/actions';
import { Megaphone } from 'lucide-react';

export async function AnnouncementBanner() {
    const text = await getAnnouncement();

    if (!text) return null;

    const texto = String(text);
    // Un aviso largo se comía media pantalla. A partir de cierto tamaño se
    // recorta a tres líneas y se abre tocándolo: <details> nativo, sin JS.
    const longo = texto.length > 180;

    const cuerpo = (
        <p
            className={`text-[13px] sm:text-sm leading-snug text-amber-950 whitespace-pre-wrap break-words ${
                longo ? 'line-clamp-3 group-open:line-clamp-none' : ''
            }`}
        >
            {texto}
        </p>
    );

    return (
        <div className="relative max-w-2xl mx-auto animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="relative overflow-hidden rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 shadow-[0_6px_20px_-12px_rgba(245,158,11,0.4)]">
                {/* brillo decorativo */}
                <div className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full bg-amber-300/20 blur-2xl" />

                <div className="relative flex items-start gap-2.5 p-3 text-left">
                    <div className="shrink-0 grid place-items-center h-7 w-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
                        <Megaphone className="h-3.5 w-3.5 text-white" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-orange-600/90">
                            <span className="h-1 w-1 rounded-full bg-orange-500" />
                            Aviso da peña
                        </span>

                        {longo ? (
                            <details className="group">
                                <summary className="cursor-pointer list-none">
                                    {cuerpo}
                                    <span className="text-[11px] font-bold text-orange-700 group-open:hidden">
                                        Ler máis
                                    </span>
                                    <span className="hidden text-[11px] font-bold text-orange-700 group-open:inline">
                                        Ler menos
                                    </span>
                                </summary>
                            </details>
                        ) : (
                            cuerpo
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
