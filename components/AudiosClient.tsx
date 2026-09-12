'use client';

import { useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { addAudio, deleteAudio, getAudios, getMeusAudios, type AudioPena } from '@/app/actions';
import { getAnonId } from '@/lib/anon-id';
import { fotoId } from '@/lib/fotos';
import { Cando } from '@/components/Cando';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Loader2, Music, Trash2, Upload, X } from 'lucide-react';

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

    const borrar = async (a: AudioPena) => {
        if (!confirm(`Borrar «${a.titulo}»?`)) return;
        const r = await deleteAudio(a.url, getAnonId());
        if (r.error) {
            setError(r.error);
            return;
        }
        setAudios(prev => prev.filter(x => x.url !== a.url));
    };

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
                <p className="text-sm text-muted-foreground text-center py-10">
                    🎵 Aínda non hai nada. Sube a primeira canción da peña.
                </p>
            ) : (
                <ul className="space-y-3">
                    {audios.map(a => {
                        const podeBorrar = isAdmin || meus.includes(fotoId(a.url));
                        return (
                            <li key={a.url} className="bg-card border rounded-xl p-3 shadow-sm">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm leading-snug flex items-center gap-1.5">
                                            <span className="shrink-0">🎵</span>
                                            <span className="truncate">{a.titulo}</span>
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            <Cando ts={a.ts} />
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <a
                                            href={urlDescarga(a)}
                                            download
                                            aria-label={`Descargar ${a.titulo}`}
                                            className="h-8 w-8 grid place-items-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
                                        >
                                            <Download className="w-4 h-4" />
                                        </a>
                                        {podeBorrar && (
                                            <button
                                                onClick={() => borrar(a)}
                                                aria-label={`Borrar ${a.titulo}`}
                                                className="h-8 w-8 grid place-items-center rounded-full text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* preload="none": non se baixa NADA ata que alguén
                                    lle dá ao play. É o que evita que abrir a páxina
                                    se coma os datos de todos coas cancións enteiras. */}
                                <audio
                                    controls
                                    preload="none"
                                    src={a.url}
                                    className="w-full mt-2 h-9"
                                />
                            </li>
                        );
                    })}
                </ul>
            )}

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                🎧 As cancións só se descargan cando lle dás ao play, e despois quedan
                gardadas no teu móbil: escoitalas outra vez xa non gasta datos.
            </p>
        </div>
    );
}
