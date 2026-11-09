import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests de la lógica pura (lib/) y de los scripts Lua del chat. Sin navegador:
// lo que toca Redis va con `vi.mock('@/lib/redis')` o contra un redis-server
// local efímero (tests/chat-lua.test.ts, se salta si no hay binario).
export default defineConfig({
    resolve: {
        alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
    },
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
        // Las fechas de las festas llevan +02:00 a mano; el resto, hora de Galicia.
        env: { TZ: 'Europe/Madrid' },
    },
});
