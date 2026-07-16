# LEARNINGS

> Una línea por bug/aprendizaje resuelto.
> Formato: * [YYYY-MM-DD] Contexto: lección técnica / resolución

* [2026-07-16] Chat: el flag `isAdmin` llegaba en el body del POST y la API se lo creía / se deriva de la cookie httpOnly `auth`, nunca del cliente.
* [2026-07-16] Chat: `DELETE` y `PATCH` (pin/unpin) no comprobaban NADA — cualquiera borraba mensajes o fijaba contenido arbitrario con un curl / guard de cookie `auth`; `react` sigue abierto porque es acción de invitado.
* [2026-07-16] `GET /api/debug/reset-score` borraba el récord sin auth y por GET (bastaba abrir la URL, o que la tocara un crawler) / borrado: era código muerto y `scripts/reset-score.ts` ya hace lo mismo.
* [2026-07-16] Server actions: ocultar el botón NO es protegerlo. Son endpoints POST reales invocables con el Action ID que viaja en el bundle público — `app/actions.ts` no tenía ni un `cookies()` / guard `isAdminRequest()` en los 5 actions de admin.
* [2026-07-16] `toggleStatus` era el más expuesto de todos, no el más destructivo: su Action ID va en el bundle de `/lista`, que es pública, y los IDs de socio los sirve esa misma página / lección: mide la exposición por dónde se sirve el bundle, no por dónde está el botón.
* [2026-07-16] Al añadir un guard, devuelve el error en la forma que el llamador YA maneja: `toggleStatus` señaliza lanzando (su catch), `bulkAddMembers` con `{error}` (su caller hace `if (res.success)`) — si no, deniegas y la UI dice "éxito".
* [2026-07-16] `addMember` se eliminó: sin callsites y exponía otro endpoint de escritura / el código muerto en un fichero `'use server'` no es inerte, es superficie de ataque.
* [2026-07-16] `/api/fotos/upload` emitía tokens de escritura a Blob sin límite ni validar el `pathname` (que llega del cliente) / 500 subidas/h por IP + regex `^fotos/[A-Za-z0-9._-]+$`.
* [2026-07-16] Rate limit por IP y no por `anonId`: un identificador que genera el cliente lo rota el atacante y solo penaliza al invitado honesto.
* [2026-07-16] Calibrar un rate limit: en el wifi de la fiesta TODOS comparten IP, así que el cupo es del grupo, no de la persona — 500/h queda 3 órdenes por encima del uso real (~200-300 fotos/h) y aun así corta el bucle de curl.
* [2026-07-16] DEUDA CONSCIENTE — los blobs se acumulan en el bucket para siempre: el `ltrim` a 300 recorta la lista de Redis, no el almacenamiento. Coste lento, sin limpieza; no es brecha.
* [2026-07-16] DEUDA CONSCIENTE — `login` (`app/admin/actions.ts`) no tiene rate limit: se mitiga con un `ADMIN_PASSWORD` largo y aleatorio en Vercel. La entropía mata la fuerza bruta sin código ni riesgo de autobloquearte (misma IP compartida del wifi). Si algún día se pone un límite, que resetee al acertar.
* [2026-07-16] Antes de tocar nada irreversible (`deleteAllMembers` estaba abierto), backup primero: `npx vercel env pull .env.local` + volcado con SCAN/TYPE por tipo. Ojo: `lib/redis.ts` falla en silencio sin envs y te devuelve un backup VACÍO que parece válido — comprueba siempre el recuento.
