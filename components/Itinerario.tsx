'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ITINERARIO, ITINERARIO_PROVISIONAL, type ItinerarioDia } from '@/lib/itinerario';
import { buscarLugar, mapaUrl, mapsUrl, type LugaresGardados } from '@/lib/lugares';
import { cn } from '@/lib/utils';
import { CalendarDays, MapPin, Clock, Map as MapIcon, Navigation } from 'lucide-react';

type EstadoEvento = 'pasado' | 'agora' | 'proximo' | 'futuro';

function eventoDate(dia: ItinerarioDia, hora: string): number {
    // Las horas de madrugada (< 06:00) pertenecen al día siguiente.
    const [h, m] = hora.split(':').map(Number);
    const [y, mo, d] = dia.fecha.split('-').map(Number);
    const date = new Date(y, mo - 1, d, h, m);
    if (h < 6) date.setDate(date.getDate() + 1);
    return date.getTime();
}

/** Cando se dá por rematada unha xornada: dúas horas despois do último acto. */
function finDoDia(d: ItinerarioDia): number {
    return eventoDate(d, d.eventos[d.eventos.length - 1].hora) + 2 * 3600_000;
}

/**
 * O sitio dun acto. Se xa sabemos onde cae (lib/lugares.ts ten as coordenadas)
 * o propio nome é o botón que leva ao mapa da web, e ao lado vai un "Ir" para
 * Google Maps. Mentres non teña coordenadas queda como estaba: só texto.
 */
function Lugar({ texto, lugares }: { texto: string; lugares: LugaresGardados }) {
    const lugar = buscarLugar(texto, lugares);

    if (!lugar) {
        return (
            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mt-1 ml-8">
                <MapPin className="w-3 h-3 shrink-0" /> {texto}
            </div>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 ml-8">
            <Link
                href={mapaUrl(lugar)}
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 pl-2 pr-2.5 py-1 text-xs font-semibold text-primary transition-transform active:scale-95"
            >
                <MapIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[190px]">{texto}</span>
            </Link>
            <a
                href={mapsUrl(lugar)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ir a ${texto} con Google Maps`}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-transform active:scale-95"
            >
                <Navigation className="w-3.5 h-3.5 shrink-0" /> Ir
            </a>
        </div>
    );
}

export function Itinerario({ lugares = {} }: { lugares?: LugaresGardados }) {
    const [now, setNow] = useState<number | null>(null);
    const [activeIdx, setActiveIdx] = useState(0);

    // Ao abrir a portada ás sete da tarde ninguén quere baixar buscando por
    // onde vai a festa: lévase a pantalla soa ao acto de agora. Só a primeira
    // vez; se despois escolles ti outro día, non se move nada.
    const actoActual = useRef<HTMLLIElement | null>(null);
    const chipActivo = useRef<HTMLButtonElement | null>(null);
    const xaCentrado = useRef(false);

    useEffect(() => {
        if (now === null || xaCentrado.current) return;
        const acto = actoActual.current;
        if (!acto) return;   // non é un día da festa, ou xa rematou
        xaCentrado.current = true;
        // Un cadro de espera: o banner de avisos e o resto da portada aínda
        // están asentando, e se mides antes quedas a medio acto.
        const id = requestAnimationFrame(() => {
            // O selector de días desprázase en horizontal: 'nearest' no bloque
            // para que iso non mova tamén a páxina enteira.
            chipActivo.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
            acto.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        return () => cancelAnimationFrame(id);
    }, [now]);

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

    // Ojo con los actos a la misma hora (el sábado hay tres a las 20:00): se
    // compara por HORA y no por posición en la lista, que si no solo el último
    // de la tanda salía en curso y los otros dos aparecían como pasados.
    // Cuándo se da por acabado un acto: cuando empieza el siguiente que sea a
    // otra hora. El último del día no tiene siguiente, así que se le dan dos
    // horas de cortesía.
    const finDe = (i: number) => {
        for (let j = i + 1; j < times.length; j++) {
            if (times[j] > times[i]) return times[j];
        }
        return times[i] + 2 * 3600_000;
    };

    /** De 0 a 1: cuánto llevamos del acto. Un 18:00-20:00 a las 19:00 va por 0,5. */
    const progresoDe = (i: number) => {
        const ini = times[i];
        const fin = finDe(i);
        if (!(fin > ini)) return 1;
        return Math.min(1, Math.max(0, (now - ini) / (fin - ini)));
    };

    const estadoDe = (i: number): EstadoEvento => {
        if (!esHoxe) return now > dayEnd ? 'pasado' : 'futuro';
        if (nextIdx === -1) return 'pasado';           // día terminado

        const t = times[i];
        if (t > now) return t === times[nextIdx] ? 'proximo' : 'futuro';
        return t === times[nextIdx - 1] ? 'agora' : 'pasado';
    };

    // A que acto se leva a pantalla: o que está en curso e, se non hai ningún,
    // o seguinte. Fóra do día de hoxe non se move nada.
    const idxDestacado = esHoxe
        ? dia.eventos.findIndex((_, i) => estadoDe(i) === 'agora' || estadoDe(i) === 'proximo')
        : -1;

    return (
        <section className="max-w-xl mx-auto mt-8 text-left">
            <div className="flex items-center justify-center gap-2 mb-4">
                <CalendarDays className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold tracking-tight">Programa da festa</h3>
            </div>

            {ITINERARIO_PROVISIONAL && (
                <p className="text-center text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 w-fit mx-auto mb-4">
                    📋 Programa do ano pasado · datas 2026 provisionais
                </p>
            )}

            {/* Selector de día (desplazable) */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-6 snap-x">
                {ITINERARIO.map((d, i) => {
                    const numDia = Number(d.fecha.slice(8, 10));
                    // Cada xornada leva debaixo en que número vai ("3/8") e un
                    // ✅ cando xa rematou, para saber de golpe por onde imos.
                    const acabou = now > finDoDia(d);
                    const enCurso = !acabou && now >= eventoDate(d, d.eventos[0].hora);
                    return (
                        <button
                            key={d.fecha}
                            ref={i === activeIdx ? chipActivo : undefined}
                            onClick={() => setActiveIdx(i)}
                            className={cn(
                                "shrink-0 snap-start flex flex-col items-center justify-center px-3 py-2 rounded-xl border min-w-[62px] transition-colors",
                                i === activeIdx
                                    ? "bg-primary text-primary-foreground border-transparent"
                                    : acabou
                                        ? "bg-card text-muted-foreground/70 border-slate-200"
                                        : "bg-card text-muted-foreground border-slate-200 hover:border-slate-300"
                            )}
                        >
                            <span className="text-[11px] font-semibold leading-none">{d.etiqueta}</span>
                            <span className="text-lg font-black leading-tight">{numDia}</span>
                            <span
                                className={cn(
                                    "flex items-center gap-0.5 text-[9px] font-bold leading-none mt-0.5 tabular-nums",
                                    i === activeIdx ? "opacity-80" : "opacity-70",
                                )}
                            >
                                {i + 1}/{ITINERARIO.length}
                                {acabou && <span aria-label="rematado">✅</span>}
                                {enCurso && (
                                    <span
                                        aria-label="hoxe"
                                        className={cn(
                                            "w-1.5 h-1.5 rounded-full animate-pulse",
                                            i === activeIdx ? "bg-primary-foreground" : "bg-primary",
                                        )}
                                    />
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Timeline */}
            <ol className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 space-y-6">
                {dia.eventos.map((ev, i) => {
                    const estado = estadoDe(i);
                    return (
                        <li
                            key={i}
                            ref={i === idxDestacado ? actoActual : undefined}
                            className="relative ml-6 scroll-mt-24"
                        >
                            {/* La línea, que va llenándose. En el acto en curso
                                llega justo por donde vamos: un 18:00-20:00 a las
                                19:00 la deja por la mitad del recuadro. */}
                            {(estado === 'pasado' || estado === 'agora') && (
                                <span
                                    aria-hidden
                                    className="absolute left-[-26px] top-0 w-[2px] bg-primary rounded-full"
                                    style={
                                        estado === 'pasado'
                                            ? { bottom: -24 }   // tapa tamén o oco ata o seguinte
                                            : { height: `${progresoDe(i) * 100}%` }
                                    }
                                />
                            )}
                            <span
                                className={cn(
                                    "absolute -left-[33px] flex items-center justify-center w-4 h-4 rounded-full ring-4 ring-background",
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
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <span className="flex items-center gap-2 font-bold leading-snug">
                                            <span className="text-xl shrink-0">{ev.icono ?? '📌'}</span>
                                            <span>{ev.titulo}</span>
                                        </span>
                                        {ev.grupo && (
                                            <p className="text-sm text-primary font-semibold mt-1 ml-8 leading-snug">{ev.grupo}</p>
                                        )}
                                        {ev.lugar && <Lugar texto={ev.lugar} lugares={lugares} />}
                                        {/* La letra pequeña del cartel: organiza,
                                            colabora, patrocina… */}
                                        {ev.nota && (
                                            <p className="text-[11px] text-muted-foreground/70 mt-0.5 ml-8 leading-snug">
                                                {ev.nota}
                                            </p>
                                        )}
                                    </div>
                                    <span className="flex items-center gap-1 text-sm font-mono font-semibold text-primary shrink-0">
                                        <Clock className="w-3.5 h-3.5" /> {ev.hora}
                                    </span>
                                </div>
                                {estado === 'agora' && (
                                    <span className="inline-block mt-2 ml-8 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                        ● Agora mesmo
                                    </span>
                                )}
                                {estado === 'proximo' && esHoxe && (
                                    <span className="inline-block mt-2 ml-8 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
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
