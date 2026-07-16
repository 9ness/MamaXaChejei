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

// El cliente sube siempre a `fotos/foto-<ts>.jpg` (ver comprimir() en FotosClient).
const RUTA_PERMITIDA = /^fotos\/[A-Za-z0-9._-]+$/;

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
                return {
                    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
                    maximumSizeInBytes: 4_000_000, // 4 MB (ya vienen comprimidas del cliente)
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
