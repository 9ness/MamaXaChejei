'use client';

import { useState, useEffect } from 'react';
import { ITINERARIO, ITINERARIO_ES_EJEMPLO, type ItinerarioDia } from '@/lib/itinerario';
import { cn } from '@/lib/utils';
import { CalendarDays, MapPin, Clock } from 'lucide-react';

type EstadoEvento = 'pasado' | 'agora' | 'proximo' | 'futuro';

function eventoDate(dia: ItinerarioDia, hora: string): number {
    // Las horas de madrugada (< 06:00) pertenecen al día siguiente.
    const [h, m] = hora.split(':').map(Number);
    const [y, mo, d] = dia.fecha.split('-').map(Number);
    const date = new Date(y, mo - 1, d, h, m);
    if (h < 6) date.setDate(date.getDate() + 1);
    return date.getTime();
}

export function Itinerario() {
    const [now, setNow] = useState<number | null>(null);
    const [activeIdx, setActiveIdx] = useState(0);

    useEffect(() => {
        const tick = () => setNow(Date.now());
        tick();
        // Selecciona por defecto el día de hoy si coincide con algún día del itinerario.
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const idx = ITINERARIO.findIndex(d => d.fecha === todayStr);
        if (idx >= 0) setActiveIdx(idx);
        const timer = setInterval(tick, 60000);
        return () => clearInterval(timer);
    }, []);

    if (now === null) return null; // evita hidratación desajustada

    const dia = ITINERARIO[activeIdx];
    const times = dia.eventos.map(e => eventoDate(dia, e.hora));

    // Índice del primer evento aún por empezar en este día.
    const nextIdx = times.findIndex(t => t > now);
    const dayStart = times[0];
    const dayEnd = times[times.length - 1];
    const esHoxe = now >= dayStart - 6 * 3600_000 && now <= dayEnd + 3 * 3600_000;

    const estadoDe = (i: number): EstadoEvento => {
        if (!esHoxe) return now > dayEnd ? 'pasado' : 'futuro';
        if (nextIdx === -1) return 'pasado';           // día terminado
        if (i < nextIdx - 1) return 'pasado';
        if (i === nextIdx - 1) return 'agora';         // evento en curso
        if (i === nextIdx) return 'proximo';
        return 'futuro';
    };

    return (
        <section className="max-w-xl mx-auto mt-8 text-left">
            <div className="flex items-center justify-center gap-2 mb-4">
                <CalendarDays className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold tracking-tight">Programa da festa</h3>
            </div>

            {ITINERARIO_ES_EJEMPLO && (
                <p className="text-center text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 w-fit mx-auto mb-4">
                    ⚠️ Programa de exemplo — pendente do cartel oficial
                </p>
            )}

            {/* Selector de día */}
            <div className="flex gap-2 justify-center mb-6">
                {ITINERARIO.map((d, i) => (
                    <button
                        key={d.fecha}
                        onClick={() => setActiveIdx(i)}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-semibold transition-colors border",
                            i === activeIdx
                                ? "bg-primary text-primary-foreground border-transparent"
                                : "bg-card text-muted-foreground border-slate-200 hover:border-slate-300"
                        )}
                    >
                        {d.etiqueta}
                    </button>
                ))}
            </div>

            {/* Timeline */}
            <ol className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 space-y-6">
                {dia.eventos.map((ev, i) => {
                    const estado = estadoDe(i);
                    return (
                        <li key={i} className="ml-6">
                            <span
                                className={cn(
                                    "absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full ring-4 ring-background",
                                    estado === 'agora' && "bg-primary animate-pulse scale-125",
                                    estado === 'proximo' && "bg-primary",
                                    estado === 'pasado' && "bg-slate-300",
                                    estado === 'futuro' && "bg-slate-400",
                                )}
                            />
                            <div
                                className={cn(
                                    "rounded-lg border p-3 shadow-sm transition-all",
                                    estado === 'agora' && "border-primary ring-1 ring-primary bg-primary/5",
                                    estado === 'proximo' && "border-primary/40 bg-card",
                                    estado === 'pasado' && "opacity-55 bg-card",
                                    estado === 'futuro' && "bg-card",
                                )}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-2 font-bold">
                                        <span className="text-xl">{ev.icono ?? '📌'}</span>
                                        {ev.titulo}
                                    </span>
                                    <span className="flex items-center gap-1 text-sm font-mono font-semibold text-primary shrink-0">
                                        <Clock className="w-3.5 h-3.5" /> {ev.hora}
                                    </span>
                                </div>
                                {ev.lugar && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                        <MapPin className="w-3 h-3" /> {ev.lugar}
                                    </div>
                                )}
                                {estado === 'agora' && (
                                    <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                        ● Agora mesmo
                                    </span>
                                )}
                                {estado === 'proximo' && esHoxe && (
                                    <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                        Próximo
                                    </span>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
