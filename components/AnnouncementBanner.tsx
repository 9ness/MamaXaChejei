import { getAnnouncement } from '@/app/actions';
import { Megaphone } from 'lucide-react';

export async function AnnouncementBanner() {
    const text = await getAnnouncement();

    if (!text) return null;

    return (
        <div className="mb-6 rounded-xl border-l-4 border-l-rose-500 border border-t-rose-200 border-r-rose-200 border-b-rose-200 bg-rose-50 p-4 text-rose-900 shadow-md flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="bg-rose-200 p-2 rounded-full shrink-0">
                <Megaphone className="h-6 w-6 text-rose-600 animate-pulse" />
            </div>
            <div className="text-base font-medium leading-relaxed whitespace-pre-wrap pt-0.5">
                <span className="font-extrabold text-rose-700 block mb-1">ATENCIÓN!</span>
                {String(text)}
            </div>
        </div>
    );
}
