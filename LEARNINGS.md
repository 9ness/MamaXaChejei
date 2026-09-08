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
* [2026-09-04] Auth: la cookie valía literalmente `auth=true` sin firmar — httpOnly frena a JS, no a quien la escribe en DevTools o manda `curl -H "Cookie: auth=true"` / cookie firmada con HMAC (`<exp>.<firma>`, secreto en `fiesta:admin_secret`) y un único `isAdmin()` en `lib/admin-auth.ts`.
* [2026-09-04] Un PIN de 4 dígitos son 10.000 combinaciones: sin rate limit no es una clave, es una formalidad / 10 intentos por IP cada 15 min, con reset al acertar para no autobloquearse en el wifi compartido de la fiesta.
* [2026-09-04] Auth que falla en ABIERTO es un agujero: `isAdmin()` devuelve false si Redis no responde, al revés que el resto de la app (que devuelve `[]` para no romper la página).
* [2026-09-04] `lib/admin-pin.ts` importa `crypto` y Redis, así que no puede entrar en un bundle de cliente / las constantes compartidas (`PIN_LENGTH`, `PIN_REGEX`) viven aparte en `lib/admin-pin-config.ts`.
* [2026-09-04] Auto-enviar el PIN al cuarto dígito desde un `useEffect` lo caza el lint de React 19 (`set-state-in-effect`) / se envía desde el propio `onChange` del teclado.
* [2026-09-04] DEUDA CONSCIENTE — el PIN se guarda hasheado (scrypt + salt), pero con 4 dígitos quien tenga un volcado de Redis lo revienta offline; el hash solo evita leerlo a simple vista.
* [2026-09-04] Admin en dos piezas: cookie `admin_device` (1 año, "sé el PIN") y cookie `auth` (modo admin encendido) / el gesto de 5 toques deja de ser un login y pasa a ser un interruptor, y el PIN solo se marca en un móvil nuevo.
* [2026-09-04] Firmar dos cookies con el mismo secreto sin meter el scope en el HMAC deja copiar el token de dispositivo (1 año) en la cookie de sesión / se firma `<scope>.<exp>`, no `<exp>` a secas.
* [2026-09-04] DEUDA CONSCIENTE — `setupPin` no pide nada: mientras `fiesta:admin_pin` no exista, quien descubra el gesto se queda de admin. La ventana va del despliegue a la primera configuración; ciérrala poniendo el PIN al momento.
* [2026-09-04] Turbopack falla el build con `app/favicon.ico` si los PNG embebidos son RGB ("The PNG is not in RGBA format!") / `Image.convert('RGBA')` antes de guardar el .ico con Pillow.
* [2026-09-04] Icono PWA maskable: Android lo recorta a círculo/squircle, así que el escudo va al 60% del lienzo con fondo blanco; el icono `any` puede ir al 86%.
* [2026-09-04] La cuota total impresa en la camiseta (28,12) no cuadra con el producto de sus 7 líneas (26,04) / el boleto oficial lleva los totales escritos a mano y solo los de la peña se calculan: manda el papel, no la aritmética.
* [2026-09-04] `toLocaleString`/`new Date()` en un componente que se pinta en servidor y cliente rompe la hidratación (Vercel va en UTC) / formateo de euros a mano y la fecha del boleto se guarda ya formateada al crearlo.
* [2026-09-04] Leer `localStorage` al montar con `useEffect`+`setState` lo caza el lint de React 19 / `useSyncExternalStore` con snapshot de servidor `''` lo hace bien y sin warning.
* [2026-09-04] Satori (`next/og`) no recorta texto ni respeta el alto disponible: el pie se montaba encima de las líneas / cortar los strings a mano y limitar a 5 líneas visibles en 1200x630.
* [2026-09-04] Compartir la imagen con `navigator.share({files})`: si el `fetch` del PNG se hace dentro del onClick, el `await` rompe la activación por gesto y Safari lo rechaza / se precarga al montar y se guarda en un ref.
* [2026-09-04] Para revisar el móvil sin instalar nada: el Chromium de Playwright (`~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome --headless --window-size=390,2400 --screenshot`).
* [2026-09-08] Apuestas sin cuentas de usuario: no hacía falta login, la app ya tenía identidad anónima (`anon_id` en localStorage, del mapa) / se extrajo a `lib/anon-id.ts` para reutilizar la MISMA persona en toda la app.
* [2026-09-08] Descontar moedas con `hincrby` negativo puede dejar el saldo bajo cero si dos pestañas apuestan a la vez / se reserva antes el sitio con `hsetnx` y, si el saldo queda negativo, se deshacen las dos operaciones.
* [2026-09-08] Pagar apuestas es idempotente por el `hsetnx` del estado, no por un flag leído antes: si el admin pulsa "Gañado" dos veces, la segunda no entra.
* [2026-09-08] Sin tope al multiplicador, un boleto de 8 líneas a cuota 50 paga 39.000 millones de moedas / `MAX_MULTIPLICADOR = 500` y `MAX_CUOTA` bajada de 999 a 50.
* [2026-09-08] Una cuota ES una probabilidad (`p = 1/cuota`) y la contraria sale de `1/(1+margen-p)` / la gente no piensa en cuotas: el formulario pide el % con un deslizador y enseña la cuota, no al revés.
* [2026-09-08] Las carpetas `app/__algo` no generan ruta: Next las trata como privadas. Para una página de pruebas, nombre sin guiones bajos delante.
* [2026-09-08] Compartir por query (`/lupebet?b=<id>`) funciona pero no es una URL de recurso / cada boleto pasó a `/lupebet/<id>` con su propio generateMetadata, y la query se quedó como redirect 307 para no romper lo ya compartido.
* [2026-09-08] Contar apostantes por boleto con `hlen` sería una consulta por tarjeta / un contador aparte (`fiesta:apostas_n`) que se lee de un tirón con `hgetall` al pintar la lista.

