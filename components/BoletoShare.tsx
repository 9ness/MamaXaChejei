'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Comparte la IMAGEN del boleto (como Bet365), no solo el enlace.
 *
 * El PNG se descarga al montar y se guarda en un ref: si se pidiera dentro del
 * onClick, el `await` del fetch rompería la activación por gesto del usuario y
 * Safari rechazaría el navigator.share(). Si el navegador no sabe compartir
 * ficheros, se cae al enlace de siempre (que ya lleva la miniatura en og:image).
 */
export function BoletoShare({
    id,
    nombre,
    sello = 0,
}: {
    id: string;
    nombre: string;
    /** Moedas apostadas. Cambia → se vuelve a pedir la imagen, para que las
     *  cuotas del PNG sean las de ahora y no las de cuando se abrió la página. */
    sello?: number;
}) {
    const file = useRef<File | null>(null);
    const [listo, setListo] = useState(false);
    const [sharing, setSharing] = useState(false);

    const imgUrl = `/api/og/lupebet?b=${encodeURIComponent(id)}`;

    useEffect(() => {
        let vivo = true;
        // Marca de tiempo + no-store: la imagen lleva las cuotas del momento, así
        // que no vale una copia guardada de hace media hora.
        fetch(`${imgUrl}&t=${Date.now()}`, { cache: 'no-store' })
            .then((res) => (res.ok ? res.blob() : null))
            .then((blob) => {
                if (!vivo || !blob) return;
                file.current = new File([blob], `lupebet-${id}.png`, { type: 'image/png' });
                setListo(true);
            })
            .catch(() => { /* se comparte el enlace y ya */ });
        return () => { vivo = false; };
    }, [imgUrl, id, sello]);

    const share = async () => {
        const url = `${window.location.origin}/lupebet/${encodeURIComponent(id)}`;
        const text = `O boleto de ${nombre} na LupeBet 🎟️ Juadalupe'26`;

        setSharing(true);
        try {
            const f = file.current;
            if (f && navigator.canShare?.({ files: [f] })) {
                await navigator.share({ files: [f], text, title: 'LupeBet' });
                return;
            }
            if (typeof navigator.share === 'function') {
                await navigator.share({ title: 'LupeBet', text, url });
                return;
            }
            window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank');
        } catch {
            /* cancelado por el usuario */
        } finally {
            setSharing(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Button onClick={share} disabled={sharing} size="lg">
                {sharing
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <Share2 className="w-4 h-4 mr-2" />}
                Compartir o boleto
            </Button>

            {/* Escapatoria de escritorio, donde casi nunca hay hoja de compartir. */}
            <Button asChild variant="outline" size="lg" title="Descargar a imaxe">
                <a href={imgUrl} download={`lupebet-${id}.png`} aria-label="Descargar a imaxe do boleto">
                    <Download className="w-4 h-4" />
                </a>
            </Button>
            <span className="sr-only">{listo ? 'Imaxe lista para compartir' : 'Preparando a imaxe'}</span>
        </div>
    );
}
