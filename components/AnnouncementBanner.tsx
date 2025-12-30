import { getAnnouncement } from '@/app/actions';
import { Megaphone } from 'lucide-react';

export async function AnnouncementBanner() {
    const text = await getAnnouncement();

    if (!text) return null;

    return (
        <div className="mb-6 rounded-xl border-l-4 border-l-rose-500 border border-t-rose-200 border-r-rose-200 border-b-rose-200 bg-rose-50 p-6 text-rose-900 shadow-md flex flex-col items-center gap-4 text-center animate-in fade-in slide-in-from-top-2 duration-500 max-w-2xl mx-auto">
            <div className="bg-rose-200 p-3 rounded-full shrink-0 shadow-sm">
                <Megaphone className="h-8 w-8 text-rose-600 animate-pulse" />
            </div>
            <div className="text-base font-medium leading-relaxed whitespace-pre-wrap">
                <span className="font-extrabold text-lg text-rose-700 block mb-2 tracking-wide">¡ATENCIÓN!</span>
                {String(text)}
            </div>
        </div>
    );
}
