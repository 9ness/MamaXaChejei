import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Autoriza la subida directa del cliente a Vercel Blob.
// Requiere la variable de entorno BLOB_READ_WRITE_TOKEN (se inyecta sola
// al conectar un almacén Blob en el panel de Vercel).
export async function POST(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody;

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async () => ({
                allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
                maximumSizeInBytes: 4_000_000, // 4 MB (ya vienen comprimidas del cliente)
                addRandomSuffix: true,
            }),
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
