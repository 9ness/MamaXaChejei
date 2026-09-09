'use client';

import { useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { addFoto, getFotos, getMeusLikes, toggleLike, type Foto } from '@/app/actions';
import { getAnonId } from '@/lib/anon-id';
import { fotoId } from '@/lib/fotos';
import { fai } from '@/lib/tempo';
import { Button } from '@/components/ui/button';
import { Camera, Flame, ImagePlus, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

// --- COMPRESIÓN EN EL MÓVIL ---
// Las fotos salen del móvil a 3-6 MB. Subirlas tal cual llena el almacén y se
// come los datos de la peña en la fiesta, así que se encogen ANTES de subir:
// se reescalan, se pasan a WebP (pesa la mitad que JPEG a igual calidad) y se
// baja la calidad por pasos hasta entrar en el objetivo.

const MAX_LADO = 1280;          // de sobra para verlas en el móvil y en el mural
const OBXECTIVO = 220_000;      // ~220 KB por foto
const CALIDADES = [0.72, 0.6, 0.5, 0.42];
const MIN_LADO = 900;           // último recurso si aun así pesa demasiado

function dibuxa(bitmap: ImageBitmap, maxLado: number): HTMLCanvasElement | null {
    const scale = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
}

function aBlob(canvas: HTMLCanvasElement, tipo: string, q: number): Promise<Blob | null> {
    return new Promise((res) => canvas.toBlob((b) => res(b), tipo, q));
}

/** Comprime en el propio móvil antes de subir. Devuelve el fichero ya pequeño. */
async function comprimir(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

    try {
        // WebP no está en todos los navegadores viejos: si toBlob no lo sabe
        // hacer, devuelve un PNG y hay que darse cuenta por el tipo.
        const proba = dibuxa(bitmap, MAX_LADO);
        if (!proba) return file;

        const test = await aBlob(proba, 'image/webp', 0.7);
        const tipo = test?.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
        const ext = tipo === 'image/webp' ? 'webp' : 'jpg';

        let mellor: Blob | null = tipo === 'image/webp' ? test : null;

        for (const lado of [MAX_LADO, MIN_LADO]) {
            const canvas = lado === MAX_LADO ? proba : dibuxa(bitmap, MIN_LADO);
            if (!canvas) break;

            for (const q of CALIDADES) {
                const blob = await aBlob(canvas, tipo, q);
                if (!blob) continue;
                if (!mellor || blob.size < mellor.size) mellor = blob;
                if (blob.size <= OBXECTIVO) {
                    return new File([blob], `foto-${Date.now()}.${ext}`, { type: tipo });
                }
            }
        }

        // Ni con la calidad más baja entra: se sube la más pequeña que salió,
        // que aun así pesa mucho menos que el original.
        if (mellor && mellor.size < file.size) {
            return new File([mellor], `foto-${Date.now()}.${ext}`, { type: tipo });
        }
        return file;
    } finally {
        bitmap.close?.();
    }
}

/**
 * Cuándo se subió: "fai 38 minutos", y de una semana en adelante, la fecha.
 * Se calcula DESPUÉS de montar, no en el render: el servidor y el móvil no
 * tienen por qué coincidir en la hora y saldría un aviso de hidratación.
 */
function Cando({ ts, claro = false }: { ts: number; claro?: boolean }) {
    const [texto, setTexto] = useState('');

    useEffect(() => {
        const pinta = () => setTexto(fai(ts, Date.now()));
        pinta();
        // Cada minuto, para que "agora mesmo" no se quede clavado si la pestaña
        // se queda abierta toda la fiesta.
        const t = setInterval(pinta, 60_000);
        return () => clearInterval(t);
    }, [ts]);

    if (!texto) return null;
    return (
        <span className={`block text-[11px] ${claro ? 'text-white/60' : 'text-muted-foreground/80'}`}>
            {texto}
        </span>
    );
}

/**
 * El botón del 🔥. Al encenderlo pega un salto y suelta tres llamitas hacia
 * arriba (CSS puro, en globals.css). Al apagarlo no hace nada: la fiesta es
 * darlo, no quitarlo.
 */
function BotonLume({
    n,
    meu,
    arde,
    grande = false,
    onClick,
}: {
    n: number;
    meu: boolean;
    /** Acaba de encenderse: dispara la animación. */
    arde: boolean;
    grande?: boolean;
    onClick: () => void;
}) {
    const clase = grande
        ? `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
            meu ? 'bg-orange-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'
        }`
        : `ml-auto shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold transition-colors ${
            meu ? 'bg-orange-100 text-orange-700' : 'text-muted-foreground hover:bg-muted'
        }`;

    return (
        <span className="relative inline-flex shrink-0">
            {arde && (
                <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    {[
                        { dx: '-14px', delay: '0ms' },
                        { dx: '2px', delay: '90ms' },
                        { dx: '15px', delay: '170ms' },
                    ].map((ch, i) => (
                        <Flame
                            key={i}
                            className="absolute w-4 h-4 text-orange-500 fill-orange-400 mxc-lume"
                            style={{ ['--dx' as string]: ch.dx, animationDelay: ch.delay }}
                        />
                    ))}
                </span>
            )}

            <button
                type="button"
                aria-pressed={meu}
                aria-label={meu ? 'Quitar o teu 🔥' : 'Dar un 🔥'}
                onClick={onClick}
                className={clase}
            >
                <Flame
                    className={`${grande ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${meu ? 'fill-current' : ''} ${arde ? 'mxc-pop' : ''}`}
                />
                {(grande || n > 0) && <span className="tabular-nums">{n}</span>}
            </button>
        </span>
    );
}

export function FotosClient({
    initialFotos,
    initialLikes = {},
}: {
    initialFotos: Foto[];
    initialLikes?: Record<string, number>;
}) {
    const [fotos, setFotos] = useState<Foto[]>(initialFotos);
    const [likes, setLikes] = useState<Record<string, number>>(initialLikes);
    const [meus, setMeus] = useState<Set<string>>(new Set());
    const [orde, setOrde] = useState<'data' | 'likes'>('data');
    // Qué foto acaba de encenderse, para lanzar la animación una sola vez.
    const [arde, setArde] = useState<string | null>(null);
    const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState('');
    const [lightbox, setLightbox] = useState<Foto | null>(null);
    // Lo elegido pero aún sin subir: así se puede ponerle un pie antes de que
    // se vaya. Si no se escribe nada, se sube igual.
    const [pendentes, setPendentes] = useState<File[]>([]);
    const [previa, setPrevia] = useState<string | null>(null);
    const [titulo, setTitulo] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    // Dos inputs: el de la cámara lleva `capture`, que en el móvil abre la
    // cámara directamente en vez de la galería. No se puede tener uno solo:
    // con `capture` puesto, ya no deja elegir de la galería.
    const camaraRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Qué fotos marcó ESTE móvil. El anonId solo existe en el navegador, así
        // que no puede venir del render del servidor.
        let vivo = true;
        getMeusLikes(getAnonId())
            .then((ids) => { if (vivo) setMeus(new Set(ids)); })
            .catch(() => { /* se quedan todas apagadas y ya */ });
        return () => {
            vivo = false;
            if (temporizador.current) clearTimeout(temporizador.current);
        };
    }, []);

    const darLike = async (url: string) => {
        const id = fotoId(url);
        if (!id) return;

        // Optimista: el 🔥 responde al momento y se corrige si el servidor dice
        // otra cosa.
        const tinao = meus.has(id);
        if (!tinao) {
            setArde(id);
            if (temporizador.current) clearTimeout(temporizador.current);
            temporizador.current = setTimeout(() => setArde(null), 900);
        }
        setMeus((prev) => {
            const s = new Set(prev);
            if (tinao) s.delete(id); else s.add(id);
            return s;
        });
        setLikes((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + (tinao ? -1 : 1)) }));

        const res = await toggleLike(getAnonId(), id);
        if (res.error) {
            setMeus((prev) => {
                const s = new Set(prev);
                if (tinao) s.add(id); else s.delete(id);
                return s;
            });
            setLikes((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + (tinao ? 1 : -1)) }));
            return;
        }
        setLikes((prev) => ({ ...prev, [id]: res.likes ?? 0 }));
    };

    const listadas = orde === 'likes'
        ? [...fotos].sort((a, b) => {
            const da = likes[fotoId(a.url)] ?? 0;
            const db = likes[fotoId(b.url)] ?? 0;
            return db - da || b.ts - a.ts;
        })
        : fotos;

    const limpiaInputs = () => {
        // Se limpian los dos: si no, elegir la misma foto otra vez no dispara
        // el onChange.
        if (inputRef.current) inputRef.current.value = '';
        if (camaraRef.current) camaraRef.current.value = '';
    };

    const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;
        setError('');
        setTitulo('');
        setPendentes(files);
        if (previa) URL.revokeObjectURL(previa);
        setPrevia(URL.createObjectURL(files[0]));
        limpiaInputs();
    };

    const cancelar = () => {
        if (previa) URL.revokeObjectURL(previa);
        setPrevia(null);
        setPendentes([]);
        setTitulo('');
    };

    const subir = async () => {
        const files = pendentes;
        if (files.length === 0) return;
        setError('');
        setBusy(true);

        let done = 0;
        for (const file of files) {
            try {
                setProgress(`Preparando ${done + 1}/${files.length}…`);
                const comprimida = await comprimir(file);
                setProgress(
                    `Subindo ${done + 1}/${files.length} · ${Math.round(comprimida.size / 1024)} KB…`,
                );
                const blob = await upload(`fotos/${comprimida.name}`, comprimida, {
                    access: 'public',
                    handleUploadUrl: '/api/fotos/upload',
                });
                await addFoto(blob.url, titulo);
                done++;
            } catch (err) {
                // El motivo técnico va á consola; á peña só lle interesa saber
                // se pode volver a intentalo.
                const msg = err instanceof Error ? err.message : '';
                setError(
                    /429|demasiad/i.test(msg)
                        ? 'Demasiadas fotos seguidas. Próbao nun anaco.'
                        : 'Non se puido subir a foto. Téntao outra vez.',
                );
                console.error(err);
                break;
            }
        }

        // Refresca a galería
        const frescas = await getFotos();
        setFotos(frescas);
        setBusy(false);
        setProgress('');
        cancelar();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col items-center gap-2">
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={onFiles}
                />
                <input
                    ref={camaraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={onFiles}
                />

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button onClick={() => camaraRef.current?.click()} disabled={busy} size="lg" className="w-full sm:w-auto">
                        {busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Camera className="w-5 h-5 mr-2" />}
                        Sacar foto
                    </Button>
                    <Button
                        onClick={() => inputRef.current?.click()}
                        disabled={busy}
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto"
                    >
                        <ImagePlus className="w-5 h-5 mr-2" />
                        Da galería
                    </Button>
                </div>
                {pendentes.length > 0 && (
                    <div className="w-full max-w-sm rounded-xl border bg-card p-3 mt-2">
                        <div className="flex gap-3">
                            {previa && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={previa}
                                    alt="A foto que vas subir"
                                    className="w-20 h-20 rounded-lg object-cover border"
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <Input
                                    value={titulo}
                                    maxLength={80}
                                    placeholder="Ponlle un título (opcional)"
                                    aria-label="Título da foto"
                                    disabled={busy}
                                    onChange={(e) => setTitulo(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') subir(); }}
                                />
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    {pendentes.length > 1
                                        ? `${pendentes.length} fotos · o título vai en todas`
                                        : 'Podes deixalo en branco.'}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                            <Button onClick={subir} disabled={busy} className="flex-1">
                                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Subir
                            </Button>
                            <Button onClick={cancelar} disabled={busy} variant="outline">
                                Cancelar
                            </Button>
                        </div>
                    </div>
                )}

                {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
                {error && <p className="text-xs text-red-600 text-center max-w-sm">{error}</p>}
            </div>

            {fotos.length === 0 ? (
                <div className="text-center text-muted-foreground py-16">
                    <ImagePlus className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>Aínda non hai fotos. Sé o primeiro en subir un recordo 📸</p>
                </div>
            ) : (
                <>
                    {/* Ordenar: por defecto as últimas, que é o que se mira na
                        festa; o outro é para ver as que máis gustaron. */}
                    {fotos.length > 1 && (
                        <div className="flex justify-center gap-1.5">
                            {([
                                { v: 'data' as const, label: '🕒 Máis recentes' },
                                { v: 'likes' as const, label: '🔥 Máis gustadas' },
                            ]).map((op) => (
                                <button
                                    key={op.v}
                                    type="button"
                                    onClick={() => setOrde(op.v)}
                                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold border transition-colors ${
                                        orde === op.v
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-card text-muted-foreground hover:bg-muted'
                                    }`}
                                >
                                    {op.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="columns-2 sm:columns-3 md:columns-4 gap-3 [&>*]:mb-3">
                        {listadas.map((f, i) => {
                            const id = fotoId(f.url);
                            const n = likes[id] ?? 0;
                            const meu = meus.has(id);

                            return (
                                <div
                                    key={`${f.url}-${i}`}
                                    className="overflow-hidden rounded-lg border shadow-sm bg-card break-inside-avoid"
                                >
                                    <button
                                        onClick={() => setLightbox(f)}
                                        className="block w-full hover:opacity-90 transition-opacity"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={f.url}
                                            alt={f.titulo || 'Recordo da peña'}
                                            loading="lazy"
                                            className="w-full h-auto"
                                        />
                                    </button>

                                    <div className="flex items-start gap-2 px-2.5 py-2">
                                        <span className="flex-1 min-w-0">
                                            {f.titulo && (
                                                <span className="block text-xs text-muted-foreground leading-snug">
                                                    {f.titulo}
                                                </span>
                                            )}
                                            <Cando ts={f.ts} />
                                        </span>
                                        <span className="ml-auto">
                                            <BotonLume
                                                n={n}
                                                meu={meu}
                                                arde={arde === id}
                                                onClick={() => darLike(f.url)}
                                            />
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {lightbox && (
                <div
                    onClick={() => setLightbox(null)}
                    className="fixed inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in"
                >
                    <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightbox(null)}>
                        <X className="w-8 h-8" />
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={lightbox.url}
                        alt={lightbox.titulo || 'Recordo'}
                        className="max-w-full max-h-[85vh] rounded-lg object-contain"
                    />
                    <div className="mt-3 text-center max-w-lg">
                        {lightbox.titulo && (
                            <p className="text-sm text-white/85">{lightbox.titulo}</p>
                        )}
                        <Cando ts={lightbox.ts} claro />
                    </div>

                    <span className="mt-3" onClick={(e) => e.stopPropagation()}>
                        <BotonLume
                            grande
                            n={likes[fotoId(lightbox.url)] ?? 0}
                            meu={meus.has(fotoId(lightbox.url))}
                            arde={arde === fotoId(lightbox.url)}
                            onClick={() => darLike(lightbox.url)}
                        />
                    </span>
                </div>
            )}

        </div>
    );
}
