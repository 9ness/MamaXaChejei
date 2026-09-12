'use client';

import { useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { addAudio, deleteAudio, getAudios, getMeusAudios, type AudioPena } from '@/app/actions';
import { getAnonId } from '@/lib/anon-id';
import { fotoId } from '@/lib/fotos';
import { Cando } from '@/components/Cando';
import { DIAS_FESTA, diaDaFoto } from '@/lib/festas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ArrowDownAZ, CalendarDays, Clock, Download, Headphones, Loader2,
    Music, Share2, Trash2, Upload, X,
} from 'lucide-react';

// 12 MB: o mesmo tope que deixa pasar a ruta de subida. Dá para uns 12 min a
// 128 kbps, moito máis do que dura unha canción da peña.
const MAX_BYTES = 12_000_000;
// MP3 e AAC/M4A son os dous que soan en Android e en iPhone sen convertir nada.
const TIPOS = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];

/**
 * A URL que obriga ao navegador a GARDAR o ficheiro en vez de poñerse a
 * reproducilo. Blob devólvea ao subir; para os audios vellos (ou se algún día
 * non vén) apáñase engadindo o mesmo parámetro que engade a súa libraría.
 */
function urlDescarga(a: AudioPena): string {
    if (a.descarga) return a.descarga;
    return a.url.includes('?') ? `${a.url}&download=1` : `${a.url}?download=1`;
}

function tamano(bytes: number): string {
    return bytes >= 1_000_000
        ? `${(bytes / 1_000_000).toFixed(1)} MB`
        : `${Math.round(bytes / 1000)} KB`;
}

export function AudiosClient({
    initialAudios,
    isAdmin = false,
}: {
    initialAudios: AudioPena[];
    isAdmin?: boolean;
}) {
    const [audios, setAudios] = useState<AudioPena[]>(initialAudios);
    const [meus, setMeus] = useState<string[]>([]);
    // O mesmo xogo de filtros que o mural, pero co seu propio estado: cambiar
    // de pestana non ten por que revolver o que estabas mirando na outra.
    // Aquí non hai 🔥, así que ese oco válo o abecedario.
    const [orde, setOrde] = useState<'data' | 'nome' | 'dias'>('data');
    const [dia, setDia] = useState<string | null>(null);
    const [pendente, setPendente] = useState<File | null>(null);
    const [titulo, setTitulo] = useState('');
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Cales subiu este móbil: son os únicos que pode borrar (ademais do admin).
    useEffect(() => {
        getMeusAudios(getAnonId()).then(setMeus).catch(() => { });
    }, []);

    const escoller = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';   // para poder volver a escoller o mesmo ficheiro
        if (!file) return;
        setError('');

        if (!TIPOS.includes(file.type)) {
            setError('Ten que ser un MP3 (ou un M4A). Outros formatos non soan en todos os móbiles.');
            return;
        }
        if (file.size > MAX_BYTES) {
            setError(`Pesa ${tamano(file.size)} e o tope son 12 MB. Baixa a calidade ao exportala.`);
            return;
        }
        setPendente(file);
        // O nome do ficheiro como título de partida: case sempre xa vale.
        if (!titulo) setTitulo(file.name.replace(/\.[^.]+$/, '').slice(0, 80));
    };

    const cancelar = () => {
        setPendente(null);
        setTitulo('');
        setError('');
    };

    const subir = async () => {
        if (!pendente) return;
        setError('');
        setBusy(true);
        setProgress(`Subindo · ${tamano(pendente.size)}…`);

        try {
            const ext = pendente.name.includes('.') ? pendente.name.split('.').pop() : 'mp3';
            const nome = `audio-${Date.now()}.${(ext || 'mp3').toLowerCase().slice(0, 4)}`;
            const blob = await upload(`audios/${nome}`, pendente, {
                access: 'public',
                handleUploadUrl: '/api/fotos/upload',
            });
            await addAudio(blob.url, titulo, getAnonId(), blob.downloadUrl);
            setAudios(await getAudios());
            cancelar();
        } catch (err) {
            const msg = err instanceof Error ? err.message : '';
            setError(
                /429|demasiad/i.test(msg)
                    ? 'Demasiadas subidas seguidas. Próbao nun anaco.'
                    : 'Non se puido subir o audio. Téntao outra vez.',
            );
            console.error(err);
        } finally {
            setBusy(false);
            setProgress('');
        }
    };

    /**
     * Comparte a canción. Vai a URL directa do MP3 e non a da páxina: quen a
     * reciba ábrea e xa soa (ou gárdaa), sen ter que buscala na app.
     * Mesmo camiño que o resto da app: folla nativa e, se non a hai, WhatsApp.
     */
    const compartir = async (a: AudioPena) => {
        const texto = `${a.titulo} 🎵 Juadalupe'26`;
        try {
            if (typeof navigator.share === 'function') {
                await navigator.share({ title: a.titulo, text: texto, url: a.url });
                return;
            }
            window.open(
                `https://wa.me/?text=${encodeURIComponent(`${texto}\n${a.url}`)}`,
                '_blank',
            );
        } catch {
            /* cancelado polo usuario */
        }
    };

    const borrar = async (a: AudioPena) => {
        if (!confirm(`Borrar «${a.titulo}»?`)) return;
        const r = await deleteAudio(a.url, getAnonId());
        if (r.error) {
            setError(r.error);
            return;
        }
        setAudios(prev => prev.filter(x => x.url !== a.url));
    };

    // Cantas cancións hai de cada xornada: serve para o selector e para saber
    // por onde abrilo.
    const porDia = audios.reduce<Record<string, number>>((acc, a) => {
        const d = diaDaFoto(a.ts);
        acc[d] = (acc[d] ?? 0) + 1;
        return acc;
    }, {});

    // Sen escoller nada, ábrese pola xornada da máis nova (a primeira da lista).
    // Nada de Date.now() aquí: o render ten que dar sempre o mesmo.
    const diaActivo = dia ?? (audios.length > 0 ? diaDaFoto(audios[0].ts) : DIAS_FESTA[0].id);

    const listados = orde === 'nome'
        ? [...audios].sort((a, b) => a.titulo.localeCompare(b.titulo, 'gl') || b.ts - a.ts)
        : orde === 'dias'
            ? audios.filter((a) => diaDaFoto(a.ts) === diaActivo)
            : audios;

    return (
        <div className="space-y-6">
            {/* Subir */}
            <div className="flex flex-col items-center gap-2">
                <input
                    ref={inputRef}
                    type="file"
                    accept="audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a"
                    className="hidden"
                    onChange={escoller}
                />
                {!pendente && (
                    <Button onClick={() => inputRef.current?.click()} className="gap-2">
                        <Upload className="w-4 h-4" /> Subir unha canción
                    </Button>
                )}

                {pendente && (
                    <div className="w-full max-w-md bg-card border rounded-xl p-3 space-y-3 shadow-sm">
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Music className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{pendente.name}</span>
                            <span className="shrink-0">· {tamano(pendente.size)}</span>
                        </p>
                        <Input
                            placeholder="Como se chama?"
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            maxLength={80}
                            className="h-9"
                        />
                        <div className="flex gap-2">
                            <Button onClick={subir} disabled={busy || !titulo.trim()} className="flex-1 gap-2">
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                {busy ? progress || 'Subindo…' : 'Subir'}
                            </Button>
                            <Button variant="ghost" onClick={cancelar} disabled={busy} aria-label="Cancelar">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {error && (
                    <p className="text-xs text-center text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-md">
                        {error}
                    </p>
                )}
            </div>

            {/* Lista */}
            {audios.length === 0 ? (
                <div className="text-center text-muted-foreground py-16">
                    <Music className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Aínda non hai nada. Sube a primeira canción da peña.</p>
                </div>
            ) : (
                <>
                    {/* Mesmos filtros ca o mural. Cun só audio non se ensinan:
                        non hai nada que ordenar. */}
                    {audios.length > 1 && (
                        <div className="flex justify-center gap-1.5 flex-wrap">
                            {([
                                { v: 'data' as const, label: 'Recentes', Icon: Clock },
                                { v: 'nome' as const, label: 'Nome', Icon: ArrowDownAZ },
                                { v: 'dias' as const, label: 'Por días', Icon: CalendarDays },
                            ]).map(({ v, label, Icon }) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => setOrde(v)}
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold border transition-colors ${
                                        orde === v
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-card text-muted-foreground hover:bg-muted'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5 shrink-0" /> {label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* As xornadas non caben todas: arrástrase de lado. Cada unha
                        ancórase ao bordo para que non queden a medias. */}
                    {orde === 'dias' && (
                        <div className="-mx-4 px-4 flex gap-1.5 overflow-x-auto no-scrollbar snap-x snap-mandatory">
                            {DIAS_FESTA.map((d) => {
                                const n = porDia[d.id] ?? 0;
                                const activo = d.id === diaActivo;
                                return (
                                    <button
                                        key={d.id}
                                        type="button"
                                        onClick={() => setDia(d.id)}
                                        className={`snap-start shrink-0 rounded-lg px-3 py-1.5 text-left border transition-colors ${
                                            activo
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : n > 0
                                                    ? 'bg-card hover:bg-muted'
                                                    : 'bg-card text-muted-foreground/50'
                                        }`}
                                    >
                                        <span className="block text-xs font-bold leading-tight whitespace-nowrap">
                                            {d.alcume ?? d.etiqueta}
                                        </span>
                                        <span className={`block text-[10px] leading-tight whitespace-nowrap ${activo ? 'opacity-80' : 'text-muted-foreground'}`}>
                                            {d.alcume ? d.etiqueta : `${n} audio${n === 1 ? '' : 's'}`}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <p className="text-center text-[11px] text-muted-foreground">
                        Cancións totais: <span className="font-bold text-foreground">{audios.length}</span>
                        {orde === 'dias' && ` · ${listados.length} nesta xornada`}
                    </p>

                    {listados.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            Nesta xornada non hai ningunha.
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {listados.map(a => {
                                const podeBorrar = isAdmin || meus.includes(fotoId(a.url));
                                return (
                                <li key={a.url} className="bg-card border rounded-xl p-3 shadow-sm">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex items-start gap-2">
                                            <Music className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm leading-snug truncate">{a.titulo}</p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                    <Cando ts={a.ts} />
                                                </p>
                                            </div>
                                        </div>
                                        {/* Borrar vai só e arriba: separado dos outros dous para
                                            non darlle sen querer ao lado de Gardar. */}
                                        {podeBorrar && (
                                            <button
                                                onClick={() => borrar(a)}
                                                aria-label={`Borrar ${a.titulo}`}
                                                className="h-8 w-8 shrink-0 grid place-items-center rounded-full text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    {/* preload="none": non se baixa NADA ata que alguén lle dá ao
                                        play. É o que evita que abrir a páxina se coma os datos de
                                        todos coas cancións enteiras. */}
                                    <audio
                                        controls
                                        preload="none"
                                        src={a.url}
                                        className="w-full mt-2 h-9"
                                    />

                                    <div className="flex gap-2 mt-2">
                                        <a
                                            href={urlDescarga(a)}
                                            download
                                            aria-label={`Gardar ${a.titulo} no móbil`}
                                            className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-xs font-semibold hover:bg-primary/10 active:scale-95 transition-all"
                                        >
                                            <Download className="w-4 h-4 shrink-0" /> Gardar
                                        </a>
                                        <button
                                            onClick={() => compartir(a)}
                                            aria-label={`Compartir ${a.titulo}`}
                                            className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-lg border bg-card text-muted-foreground text-xs font-semibold hover:bg-muted active:scale-95 transition-all"
                                        >
                                            <Share2 className="w-4 h-4 shrink-0" /> Compartir
                                        </button>
                                    </div>
                                </li>
                                );
                            })}
                        </ul>
                    )}
                </>
            )}

            {/* Sen prometer de máis: a caché do navegador dura o que o navegador
                queira (Blob pide un mes, pero iso é "best effort" e Safari bórrao
                en canto lle fai falta sitio). Quedar coa canción de verdade é
                darlle a Gardar. */}
            <div className="text-[11px] text-muted-foreground leading-relaxed max-w-md mx-auto space-y-1.5">
                <p className="flex gap-1.5">
                    <Headphones className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                        Non se baixa nada ata que lle dás ao play. Despois o móbil adoita
                        gardala un tempo e volver a escoitala non gasta datos, pero o
                        navegador bórraa cando precisa sitio.
                    </span>
                </p>
                <p className="flex gap-1.5">
                    <Download className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                        Para quedar con ela de verdade —sen cobertura, ou para mandala
                        por WhatsApp— dálle a <span className="font-semibold">Gardar</span>.
                    </span>
                </p>
            </div>
        </div>
    );
}
