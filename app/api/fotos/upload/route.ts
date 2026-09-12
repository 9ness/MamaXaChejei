import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { clientIp, rateLimited } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Subir fotos es una acción de invitado: NO lleva auth a propósito. Lo que se
// limita es el abuso, porque cada token permite escribir en el bucket (que se
// factura por GB almacenado y por ancho de banda).
// 500/h por IP: en el wifi de la fiesta todos comparten IP y una fiesta hace
// ~200-300 fotos/hora, así que un invitado real nunca lo toca; un bucle de curl
// haría miles por minuto y se corta.
const MAX_SUBIDAS = 500;
const VENTANA_S = 60 * 60; // 1 hora

// El cliente sube a `fotos/foto-<ts>.jpg` (ver comprimir() en FotosClient) o a
// `audios/audio-<ts>.mp3` (AudiosClient). Nada más.
const RUTA_PERMITIDA = /^(fotos|audios)\/[A-Za-z0-9._-]+$/;

// Los audios no se comprimen en el móvil (una canción ya viene en MP3), así que
// llevan su propio tope: 12 MB dan para ~12 min a 128 kbps, de sobra.
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
// MP3 y AAC/M4A: son los dos que suenan en Android y en iPhone sin convertir.
const TIPOS_AUDIO = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];
const MAX_FOTO = 4_000_000;
const MAX_AUDIO = 12_000_000;

// Autoriza la subida directa del cliente a Vercel Blob.
// Requiere la variable de entorno BLOB_READ_WRITE_TOKEN (se inyecta sola
// al conectar un almacén Blob en el panel de Vercel).
export async function POST(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody;

    // Solo limitamos la emisión de tokens; 'blob.upload-completed' lo llama
    // Vercel por webhook, no el usuario.
    if (body.type === 'blob.generate-client-token') {
        if (await rateLimited('upload', clientIp(request), MAX_SUBIDAS, VENTANA_S)) {
            return NextResponse.json(
                { error: 'Demasiadas subidas. Inténtalo dentro de un rato.' },
                { status: 429 },
            );
        }
    }

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname) => {
                // El pathname llega del cliente: sin esto se puede escribir en
                // cualquier ruta del bucket, no solo bajo fotos/.
                if (!RUTA_PERMITIDA.test(pathname)) {
                    throw new Error('Ruta no permitida');
                }
                const esAudio = pathname.startsWith('audios/');
                return {
                    allowedContentTypes: esAudio ? TIPOS_AUDIO : TIPOS_FOTO,
                    maximumSizeInBytes: esAudio ? MAX_AUDIO : MAX_FOTO,
                    addRandomSuffix: true,
                };
            },
            // En Vercel esto se dispara al completar; en local no llega webhook,
            // por eso el cliente además llama a addFoto() con la URL final.
            onUploadCompleted: async () => { },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 400 },
        );
    }
}
