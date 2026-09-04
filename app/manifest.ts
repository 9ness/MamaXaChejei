import type { MetadataRoute } from 'next';

// Manifest de la PWA: es lo que Android/iOS leen al "Añadir a pantalla de
// inicio". Sin esto se quedaban el nombre y el icono por defecto de Next.
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Mamá xa Chejei',
        short_name: 'MXC',
        description: 'A app da peña MamaXaChejei — Festas da Guadalupe, Rianxo.',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#1f2a7a', // azul marino de la camiseta de J'26
        icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            // Android recorta a círculo/squircle: esta lleva margen de seguridad.
            { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
    };
}
