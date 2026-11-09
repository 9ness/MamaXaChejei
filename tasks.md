# Tareas — MamaXaChejei

## Pendiente
- Push a `main` de los commits locales del sprint del 2026-11-09 (76af88b, 5f5088e, ee73f68 y el de tests): despliega en Vercel, espera el OK de Néstor.
- `npm audit`: quedan 8 avisos moderados, todos de `minimatch` dentro de typescript-eslint (solo dev). Se arreglan cuando typescript-estree admita minimatch 11; no forzar.
- `GET /api/chat` devuelve 500 si Redis no responde (el resto de la app devuelve vacío). Decidir si devolver `{messages: []}`.
- 20 avisos de lint (`<img>` en vez de `next/image`, deps de hooks…), ninguno es error.
- `scripts/seed-data.ts` sigue desincronizado (SET vs ZSET): arreglar o borrar (gotcha 2 de AGENTS.md).
- Tests de UI (componentes) no hay: solo `lib/`. Si se quieren, añadir jsdom + Testing Library.
- Cartel 2027: cuando salga, actualizar `lib/itinerario.ts`, `DIAS_FESTA` + `ANO_FESTA` (`lib/festas.ts`) y `TARGET_DATE` (`Countdown.tsx`). Hasta entonces la portada enseña una fecha ESTIMADA (venres 10 de setembro de 2027).
- `/resumo` lee 9 cosas de Redis en cada visita (sin caché). Con el uso de la peña sobra; si algún día pesa, cachear el resultado unos minutos.

## ✅ Done
- 2026-11-09 · Dependencias al día: Next 16.4.5, React 19.3.1, audit 21 → 8 (76af88b).
- 2026-11-09 · Lint de React 19: 32 → 0 errores (5f5088e).
- 2026-11-09 · Chat atómico con Lua + emoji validado + rate limit (ee73f68).
- 2026-11-09 · Vitest: 68 tests (lógica de lib/, auth, rate limit y Lua contra redis-server).
- 2026-11-09 · `/resumo`: «A Guadalupe en cifras» (cifras, podio de fotos, fotos por xornada, xogo, LupeBet, canción) + 13 tests (rama `fable/2026-11-09`).
- 2026-11-09 · Portada fóra de tempada: días para a Guadalupe 2027 (data aproximada), accesos ao resumo e ás fotos, e o programa pasado plegado (rama `fable/2026-11-09`).
