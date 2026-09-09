'use client';

import { useState, useRef } from 'react';
import { upload } from '@vercel/blob/client';
import { addFoto, getFotos, type Foto } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Camera, ImagePlus, Loader2, X } from 'lucide-react';

// Comprime en el propio móvil antes de subir (baja calidad → poco peso).
async function comprimir(file: File, maxDim = 1280, quality = 0.7): Promise<File> {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob = await new Promise((res) =>
        canvas.toBlob((b) => res(b ?? file), 'image/jpeg', quality),
    );
    return new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

export function FotosClient({ initialFotos }: { initialFotos: Foto[] }) {
    const [fotos, setFotos] = useState<Foto[]>(initialFotos);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState('');
    const [lightbox, setLightbox] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    // Dos inputs: el de la cámara lleva `capture`, que en el móvil abre la
    // cámara directamente en vez de la galería. No se puede tener uno solo:
    // con `capture` puesto, ya no deja elegir de la galería.
    const camaraRef = useRef<HTMLInputElement>(null);

    const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;
        setError('');
        setBusy(true);

        let done = 0;
        for (const file of files) {
            try {
                setProgress(`Preparando ${done + 1}/${files.length}…`);
                const comprimida = await comprimir(file);
                setProgress(`Subindo ${done + 1}/${files.length}…`);
                const blob = await upload(`fotos/${comprimida.name}`, comprimida, {
                    access: 'public',
                    handleUploadUrl: '/api/fotos/upload',
                });
                await addFoto(blob.url);
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
        // Se limpian los dos: si no, elegir la misma foto otra vez no dispara
        // el onChange.
        if (inputRef.current) inputRef.current.value = '';
        if (camaraRef.current) camaraRef.current.value = '';
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
                {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
                {error && <p className="text-xs text-red-600 text-center max-w-sm">{error}</p>}
            </div>

            {fotos.length === 0 ? (
                <div className="text-center text-muted-foreground py-16">
                    <ImagePlus className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>Aínda non hai fotos. Sé o primeiro en subir un recordo 📸</p>
                </div>
            ) : (
                <div className="columns-2 sm:columns-3 md:columns-4 gap-3 [&>*]:mb-3">
                    {fotos.map((f, i) => (
                        <button
                            key={`${f.url}-${i}`}
                            onClick={() => setLightbox(f.url)}
                            className="block w-full overflow-hidden rounded-lg border shadow-sm break-inside-avoid hover:opacity-90 transition-opacity"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={f.url} alt="Recordo da peña" loading="lazy" className="w-full h-auto" />
                        </button>
                    ))}
                </div>
            )}

            {lightbox && (
                <div
                    onClick={() => setLightbox(null)}
                    className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4 animate-in fade-in"
                >
                    <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightbox(null)}>
                        <X className="w-8 h-8" />
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={lightbox} alt="Recordo" className="max-w-full max-h-full rounded-lg object-contain" />
                </div>
            )}
        </div>
    );
}
