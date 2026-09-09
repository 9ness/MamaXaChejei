# AGENTS.md — MamaXaChejei

> Manual de trabajo para agentes de IA (Claude Code / OpenCode) en este repo.
> Idioma de comunicación con el usuario: **ESPAÑOL** (la UI mezcla español y
> gallego — respeta el idioma que ya tenga cada texto).

---

## Selección de modelo (auto-routing — hazlo ANTES de empezar la tarea)
Este proyecto trabaja con dos PERFILES, no con nombres fijos:
- Perfil PESADO (rol tipo "Opus": el potente) — mejor en ficheros enormes y tareas largas/multi-fichero.
- Perfil DIARIO (rol tipo "Sonnet": rápido y barato) — el de por defecto para tareas normales.

| Perfil | Modelo |
|---|---|
| PESADO | el modelo potente del usuario (él sabe cuál cargar) |
| DIARIO | el modelo rápido/barato del usuario (él sabe cuál cargar) |

Al recibir una tarea, clasifícala y avisa en UNA línea. Es PESADA si cumple CUALQUIERA:
- Localizar/modificar detalles en un fichero muy grande (> ~2000 líneas) o varios grandes.
- El cambio toca MÁS de ~3-4 ficheros o muchos call-sites.
- Tarea multi-paso larga (migración, barrido) de muchos turnos.
- Perder el hilo entre pasos tendría coste alto.
Si no, es LIGERA. Si es PESADA: di "Esta tarea es PESADA (motivo: …), usa el perfil PESADO
(ver tabla); si no lo tienes cargado, cámbialo antes de seguir." Si es LIGERA: procede sin avisar.
En ficheros de miles de líneas, si concluyes que algo "no existe", haz grep del nombre exacto antes de afirmarlo.

**Ficheros que casi siempre disparan PESADO aquí:** ninguno supera las ~1.000
líneas (el mayor es `app/actions.ts`, ~612). Los candidatos a tarea PESADA son
por AMPLITUD, no por tamaño: `app/actions.ts` (612) es el hub de datos y casi
cualquier cambio de schema lo toca junto a `components/MemberTable.tsx` (516),
`components/MemberList.tsx` (311) y `components/MapaClient.tsx` (487).

---

## 1. Resumen del proyecto

App web de una peña de fiestas (Festas da Guadalupe, Rianxo) — "MamaXaChejei".
Es un Next.js App Router **sin backend propio**: los Server Actions de
`app/actions.ts` hablan directamente con Upstash Redis (REST/HTTP) y ahí vive
TODO el estado. Funciones: lista de miembros de la peña con talla de camiseta y
control de pagado/recogido (`/lista` pública, `/gestion` admin), itinerario del
cartel de fiestas y cuenta atrás en la home, mapa en vivo con Leaflet para
compartir ubicación anónima (puntual con TTL o "en directo"), mural de fotos en
Vercel Blob (`/recuerdos`), chat global flotante con pin/reacciones, un
minijuego de cervezas con récord global, y una paleta de color de la peña que el
admin cambia y tiñe toda la UI vía variables CSS.

**Stack:** Next.js 16 (App Router, RSC + Server Actions) · React 19 ·
TypeScript (strict) · Tailwind 3.4 + shadcn/ui (style new-york, baseColor
neutral) + Radix + lucide-react · Upstash Redis (`@upstash/redis`, REST) ·
Vercel Blob (`@vercel/blob`) · Leaflet · Zod · canvas-confetti · tsx para
scripts. Sin tests, sin CI (no hay `.github/`).

---

## 2. Comandos reales

Todo desde la RAÍZ del repo (no hay monorepo). Gestor: **npm**.

```bash
npm install
npm run dev      # next dev  → http://localhost:3000
npm run build    # next build
npm run start    # next start
npm run lint     # eslint (flat config: eslint.config.mjs)
```

Typecheck (no hay script en package.json; el usuario lo permite en
`.claude/settings.local.json`):
```bash
npx tsc --noEmit
```

Scripts de mantenimiento sobre Redis (`tsx`, leen `.env.local`):
```bash
npx tsx scripts/seed-data.ts          # ⚠️ BORRA y repuebla miembros (ver gotcha 2)
npx tsx scripts/reset-score.ts        # pone el récord del juego a 0
npx tsx scripts/force-reset-score.ts  # reset del récord + verificación por consola
npx tsx scripts/set-admin-pin.ts 1234 # pone el PIN de admin y cierra sesiones abiertas
```

**Tests:** no existen. **CI:** no existe. PENDIENTE: confirmar si se quieren.
**Deploy:** Vercel (el `.claude/settings.local.json` permite `npx vercel *`, y
`@vercel/blob` es dependencia). No hay `vercel.json`. PENDIENTE: confirmar
proyecto/comando exacto de despliegue.

---

## 3. Arquitectura y directorios clave

```
app/
  layout.tsx          # RSC raíz: lee cookie `auth`, inyecta la paleta de la peña
                      #   como <style> y monta BottomNav + GlobalChat globales
  page.tsx            # Home: Header (cuenta atrás) + Itinerario
  actions.ts          # ⭐ HUB: TODOS los Server Actions y TODAS las keys de Redis
                      #   (miembros, anuncio, chat, récord, color, fotos, ubicaciones)
  lista/page.tsx      # lista pública de miembros (solo lectura)
  gestion/page.tsx    # panel admin (login por cookie) — alta/edición, anuncio, color
  admin/page.tsx      # redirect → /gestion
  admin/actions.ts    # setupPin/loginWithPin/enable|disableAdminMode/changePin/logout
  mapa/page.tsx       # mapa Leaflet (MapaClient)
  recuerdos/page.tsx  # mural de fotos
  lupebet/page.tsx    # LupeBet: boleto oficial de la camiseta + los de la peña
  lupebet/[id]/page.tsx       # ficha de un boleto (URL propia para compartir)
  api/og/lupebet/route.tsx    # imagen del boleto (la que se comparte)
  api/chat/route.ts   # GET/POST/DELETE/PATCH del chat (pin, unpin, react)
  api/fotos/upload/route.ts   # handleUpload de Vercel Blob (subida directa cliente)
  api/debug/reset-score/route.ts  # ⚠️ reset del récord por GET, SIN AUTH
  globals.css         # variables CSS de shadcn (light/dark)
components/
  MemberTable.tsx (516) MemberList.tsx (311) MemberCard.tsx   # lista/edición miembros
  MapaClient.tsx (487)   # Leaflet + geolocalización + sesión de compartido
  GlobalChat.tsx (420)   # chat flotante (polling) + monta BeerGame
  BeerGame.tsx (519)     # minijuego
  Itinerario.tsx, Countdown.tsx, Header.tsx, BottomNav.tsx,
  AnnouncementForm.tsx, AnnouncementBanner.tsx, AdminControls.tsx,
  PenaColorPicker.tsx, LoginForm.tsx, FotosClient.tsx,
  BoletoTicket.tsx      # réplica del boleto de la camiseta (blanco + azul marino)
  BoletoForm.tsx        # crear tu boleto de broma (cuota total en vivo)
  BoletoList.tsx        # boletos de la peña + borrado de admin
  BoletoShare.tsx       # comparte la IMAGEN del boleto (Web Share con files)
  ApostarPanel.tsx      # apostar moedas (identidad = anon_id del navegador)
  ResolverBoleto.tsx    # admin: cerrar un boleto como gañado/perdido
  LupeBetCard.tsx       # bloque de la portada que lleva a /lupebet
  SecretAdminGate.tsx   # 5 toques en el título de Header → interruptor admin
  AdminPinFlow.tsx      # flujo del PIN (marcar / crear+repetir), compartido
  PinPad.tsx            # teclado numérico controlado (login y cambio de PIN)
  ChangePinForm.tsx     # cambiar el PIN desde /gestion
  ui/                 # shadcn generado (no editar a mano salvo necesidad)
lib/
  redis.ts            # cliente Upstash único (con cliente dummy si faltan envs)
  itinerario.ts       # ⚠️ DATOS del cartel, hardcodeados. 2026 es PROVISIONAL
  pena-colors.ts      # presets de paleta → variables CSS
  lupebet.ts          # ⚠️ DATOS del boleto de la camiseta + cálculo de cuotas
  anon-id.ts          # identidad anónima por dispositivo (misma que el mapa)
  admin-auth.ts       # ⭐ isAdmin(): cookie de sesión firmada con HMAC
  admin-pin.ts        # PIN de admin en Redis (scrypt + salt)
  admin-pin-config.ts # constantes del PIN compartidas con el cliente
  rate-limit.ts       # ventana fija sobre Redis + IP del cliente
  utils.ts            # cn()
scripts/              # tsx sueltos contra Redis (seed / reset récord)
public/               # sprites del juego (man*.png, ~2 MB cada uno)
```

**Fuente de verdad de datos:** Redis, namespace `fiesta:` (constante
`NAMESPACE` en `app/actions.ts`, NO configurable por env).

| Key | Tipo | Contenido |
|---|---|---|
| `fiesta:miembros_zset` | ZSET | IDs de miembros ordenados (score = orden) |
| `fiesta:miembro:<id>` | HASH | miembro (schema Zod `MemberSchema`) |
| `fiesta:anuncio` | STRING | texto del banner |
| `fiesta:chat` | LIST | últimos 50 mensajes (LPUSH + LTRIM 0 49) |
| `fiesta:chat:pinned` | STRING | mensaje fijado |
| `fiesta:highscore` | STRING | `{name, score}` (escrito con Lua atómico) |
| `fiesta:total_games` | STRING | contador INCR |
| `fiesta:color` | STRING | key del preset de paleta |
| `fiesta:fotos` | LIST | fotos del mural (JSON `{url, ts, titulo?}`) |
| `fiesta:fotos_likes` | HASH | fotoId → nº de 🔥 |
| `fiesta:fotos_like_de:<anonId>` | SET | fotos que marcó ese móvil |
| `fiesta:loc:<anonId>` | STRING + TTL | punto del mapa (15/30/60 min o directo) |
| `fiesta:loc_ids` | SET | índice de puntos (se auto-limpia al leer caducados) |
| `fiesta:boletos` | LIST | boletos de broma de la peña (JSON, LTRIM 0 199) |
| `fiesta:boletos_estado` | HASH | boletoId → `ganado`/`perdido` (aparte, para no reescribir la lista) |
| `fiesta:boletos_destacados` | SET | boletoIds que el admin sube a "Os pronósticos da peña" |
| `fiesta:apostas:<boletoId>` | HASH | anonId → apuesta `{nombre, moedas, ts}` |
| `fiesta:apostas_total` | HASH | boletoId → moedas apostadas (contador para la lista) |
| `fiesta:apostas_n` | HASH | boletoId → nº de apostantes (mismo motivo) |
| `fiesta:moedas` | HASH | anonId → saldo (arranca en 1000) |
| `fiesta:moedas_nome` | HASH | anonId → nombre, solo para la clasificación |
| `fiesta:admin_pin` | HASH | `{salt, hash}` del PIN de admin (scrypt) |
| `fiesta:admin_secret` | STRING | secreto HMAC con el que se firma la cookie de sesión |

**Variables de entorno** (en `.env.local`, ignorado por git — no hay
`.env.example`): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
`ADMIN_PASSWORD` (solo como arranque, hasta que haya PIN), `BLOB_READ_WRITE_TOKEN` (lo inyecta Vercel al conectar el
store Blob). PENDIENTE: confirmar si conviene crear un `.env.example`.

---

## 4. Convenciones

- **Código:** TypeScript strict. Identificadores mayormente en inglés pero el
  dominio va en español (`Member`, `nombre`, `apellido1`, `talla`, `pagado`,
  `recogido`). Comentarios y textos de UI en español/gallego. Alias de import
  `@/*` → raíz (`@/lib/redis`, `@/components/ui/button`).
- **RSC por defecto**; `'use client'` solo donde hay estado/efectos. Las páginas
  con datos llevan `export const dynamic = 'force-dynamic'` — mantenlo o
  servirás datos cacheados de Redis.
- **Mutaciones = Server Actions** en `app/actions.ts` (`'use server'`), no API
  routes. Excepción histórica: el chat y la subida de fotos usan `app/api/**`.
  Tras mutar, `revalidatePath()` de las rutas afectadas; para lecturas que no
  se pueden cachear, `unstable_noStore as noStore`.
- **Errores defensivos:** casi todos los actions envuelven en `try/catch` y
  devuelven `[]` / `{ success: false }` en vez de lanzar. Mantén ese patrón —
  la app nunca debe romper la página por un fallo de Redis.
- **Sanitización:** trunca siempre las entradas antes de escribir en Redis
  (`slice(0, 30)` nombre, `slice(0, 500)` mensaje, `slice(0, 24)` nombre del
  mapa…) y valida coordenadas. Sigue haciéndolo en cualquier campo nuevo.
- **Estilo:** Tailwind + shadcn con variables CSS HSL. Los colores de marca
  salen de `lib/pena-colors.ts` (`--primary`, `--ring`, `--pena-from/to`) — no
  hardcodees hex de marca en componentes.
- **Mobile-first:** la app se usa desde el móvil en la fiesta. `BottomNav` con
  `pb-20 md:pb-0`. Valida cualquier UI nueva en pantalla estrecha. La barra
  lleva 5 pestañas (6 en modo admin) y la rejilla se ajusta sola; a 6 quedan
  ~65px por hueco, así que no metas etiquetas más largas que "Recuerdos".
- **Commits:** NO son Conventional Commits. La convención detectada en
  `git log` es `Área: descripción en español`, con el área como sustantivo
  capitalizado. Ej.: `Mapa: persistir la sesión de compartido y reanudarla al
  recargar`, `Inicio: itinerario completo del cartel 2025 (8 días)`,
  `Fix: limpiado repositorio y actualizados efectos del juego`. (Los commits
  más antiguos usaban minúsculas sueltas tipo `optimizacion xogo`; usa el
  estilo reciente.)
- **Rama por defecto:** `main`. Remote: `origin` →
  `github.com/9ness/MamaXaChejei`.
- **Formato:** sin Prettier ni config de formateo; solo `eslint-config-next`
  (core-web-vitals + typescript) en flat config. Indentación real: 4 espacios
  en `app/`, `components/` y `lib/`; 2 en algunos ficheros generados
  (`layout.tsx`, configs). Respeta la del fichero que toques.

---

## 5. Gotchas / cosas no obvias

1. **`lib/redis.ts` no falla si faltan las envs**: devuelve un cliente dummy
   apuntando a `example.com` y solo escupe un `console.warn`. Síntoma real: la
   app carga pero todo sale vacío. Si ves listas vacías, comprueba
   `.env.local` ANTES de depurar lógica.
2. **`scripts/seed-data.ts` está DESINCRONIZADO**: usa `fiesta:miembros_ids`
   (SET) mientras `app/actions.ts` lee `fiesta:miembros_zset` (ZSET). Sembrar
   con él NO puebla la lista de la app, y además borra su propia key antes.
   No lo uses como referencia del schema — la referencia es `app/actions.ts`.
   PENDIENTE: confirmar si se arregla o se borra.
3. **`GET /api/debug/reset-score` no tiene auth**: cualquiera con la URL borra
   el récord del juego. PENDIENTE: confirmar si se protege o se elimina.
4. **El "admin" del chat es cosmético**: `GlobalChat.tsx` deduce `isAdmin` de
   `pathname === '/gestion'` y lo manda en el body; `app/api/chat/route.ts` se
   fía de ese flag sin comprobar la cookie. DELETE y PATCH (pin/unpin/react)
   tampoco verifican auth. No asumas que el chat está protegido.
5. **Auth: DOS cookies firmadas** (httpOnly, valor `<caducidad>.<HMAC>`, el
   scope entra en la firma), secreto en `fiesta:admin_secret`:
   `auth` (7 días) = modo admin encendido AHORA; `admin_device` (1 año) = este
   móvil ya marcó el PIN. Fuentes de verdad: `isAdmin()` e `isTrustedDevice()`
   de `lib/admin-auth.ts` — úsalas siempre, no compares cookies a mano (antes
   valía `auth=true` a pelo y cualquiera la escribía). **No hay middleware**:
   cualquier ruta o action nuevo de admin debe llamar a `isAdmin()` por su
   cuenta. Borrar `fiesta:admin_secret` echa a todos los dispositivos.
   Entrada: 5 toques en el título de `Header` (`SecretAdminGate`). Sin PIN en
   Redis pide crearlo (`setupPin`, solo mientras `fiesta:admin_pin` no exista);
   con PIN pide marcarlo; y en un móvil ya de confianza el gesto solo enciende
   y apaga el modo admin (`enableAdminMode`/`disableAdminMode`). `ADMIN_PASSWORD`
   sigue valiendo como respaldo mientras no haya PIN. Login limitado a 10
   intentos / 15 min por IP (`lib/rate-limit.ts`), con reset al acertar.
   "Salir" de `/gestion` borra las DOS cookies (desautoriza el móvil).
6. **Chat: borrar/reaccionar reescribe la lista entera** (LRANGE → filtrar →
   DEL → RPUSH). No es atómico y hay carrera si dos escriben a la vez. El
   récord del juego SÍ usa un script Lua atómico (`saveHighScore`) —
   respétalo, se hizo a propósito.
7. **Los booleanos de Redis vuelven como string**: `getMembers()` hace
   `String(m.pagado) === 'true'`. Cualquier campo booleano nuevo necesita el
   mismo tratamiento al leer del HASH.
8. **`@upstash/redis` a veces auto-parsea el JSON** y a veces devuelve string —
   por eso el código repite `typeof raw === 'object' ? raw : JSON.parse(raw)`.
   Mantén ese doble camino en lecturas nuevas.
9. **`lib/itinerario.ts` son datos, no lógica**: el cartel es el de 2025 y las
   fechas de 2026 son PROVISIONALES (flag `ITINERARIO_PROVISIONAL = true`).
   `components/Countdown.tsx` tiene la fecha objetivo **hardcodeada**
   (`2026-09-12T00:00:00`, hora local del navegador). Si cambian las fechas,
   hay que tocar los dos sitios.
16. **LupeBet:** el boleto oficial son DATOS en `lib/lupebet.ts`, no Redis —
    es el de la camiseta y se copia tal cual, faltas incluidas ("Janador",
    "veses"), que son el chiste. Su cuota total impresa (28,12) NO es el
    producto de las 7 líneas (sale 26,04): por eso el oficial lleva
    `cuotaTotal`/`ganancia` a mano y solo los de la peña se calculan. El azul
    `LUPE_AZUL` va a fuego y no sale de `pena-colors.ts` a propósito: el boleto
    debe verse igual que la camiseta aunque cambien la paleta.

17. **Moedas de LupeBet:** la identidad es el `anon_id` de `localStorage` (el
    mismo del mapa), NO hay cuentas — quien borre los datos del navegador
    empieza de cero con 1000 moedas. Asumido a propósito. Al apostar, el orden
    es: `hsetnx` en `fiesta:apostas:<id>` (reserva atómica, una apuesta por
    persona) y solo después `hincrby` negativo del saldo; si queda en negativo
    se deshacen las dos cosas. Cerrar un boleto también va con `hsetnx` sobre
    `fiesta:boletos_estado`: es lo único que impide pagar dos veces si el admin
    pulsa dos veces. Los pagos están topados por `MAX_MULTIPLICADOR` (500) —
    sin ese tope, 8 líneas a cuota 50 pagarían miles de millones.
    Cada boleto tiene su URL, `/lupebet/<id>`; `/lupebet?b=<id>` sigue vivo pero
    solo redirige (había enlaces compartidos con esa forma). La barra de usuario
    (`LupeBetUser`) copia el nombre del chat a `fiesta:moedas_nome` nada más
    entrar, así que en la clasificación ya sale gente que no ha apostado nunca.

18. **Cuotas dinámicas de LupeBet:** se apuesta a los dos lados (`si`/`non`) y
    la cuota se mueve con las moedas de cada lado — `mercadoBoleto()` en
    `lib/lupebet.ts` desplaza la probabilidad de salida en log-odds según la
    presión del dinero, con `LIQUIDEZ` (300 moedas imaginarias defendiendo el
    precio) y `DERIVA_MAX` (×2,5 como mucho). La cuota del `si` sin dinero
    encima es EXACTAMENTE la del boleto: el margen se lo come el lado `non`.
    La cuota se **congela** al apostar (`Aposta.cuota`, la calcula el servidor,
    nunca el cliente) y `resolverBoleto` paga con `multiplicadorAposta()`; las
    apuestas viejas sin `cuota` cobran a la de salida.

10. **Mapa:** coordenadas del recinto y de las orquestas hardcodeadas en
    `MapaClient.tsx` (Praza de Castelao, Rianxo — hubo commits corrigiendo
    Padrón→Rianxo, no lo revuelvas). El modo "en directo" reescribe el punto
    cada ~4 s con TTL de 60 s y la sesión se persiste en `localStorage`
    (`mapa_share`); el TTL de Redis es solo red de seguridad, la duración real
    la controla el cliente. Leaflet se importa dinámicamente en cliente — no lo
    metas en un RSC.
11. **Fotos:** subida directa cliente → Vercel Blob (store `mamaxachejei-fotos`,
    CDG1, público). En local NO llega el webhook `onUploadCompleted`, por eso el
    cliente llama además a `addFoto()` con la URL final. Límite 4 MB y solo
    jpeg/png/webp; el cliente comprime a WebP con objetivo de ~220 KB. Cada foto
    puede llevar un pie opcional (`Foto.titulo`). Los 🔥 van aparte, en
    `fiesta:fotos_likes` (contador) + `fiesta:fotos_like_de:<anonId>` (SET), y la
    identidad de una foto es el nombre del fichero en Blob (`lib/fotos.ts`), no
    un id propio: así funciona también con las fotos viejas.
12. **`components.json` declara `tailwind.config: ""`** aunque existe
    `tailwind.config.js` (Tailwind **3.4**, no 4). Si añades componentes shadcn
    con la CLI, revisa que no te reescriba la config ni el `globals.css`.
13. **Iconos y PWA:** `app/icon.png`, `app/apple-icon.png` y `app/favicon.ico`
    salen del escudo MXC; `app/manifest.ts` define nombre ("Mamá xa Chejei"),
    `short_name` MXC y los iconos de `public/icon-*.png`. El `.ico` tiene que
    llevar PNG en **RGBA** o Turbopack revienta el build al procesarlo. El
    icono maskable lleva margen porque Android recorta a círculo.
14. **`public/man*.png` pesan ~2 MB cada uno** (7 sprites, ~13 MB). Si tocas el
    juego, no añadas más peso sin optimizar.
15. **La paleta se inyecta con `dangerouslySetInnerHTML`** en el `<head>` desde
    un valor de Redis. Solo puede venir de los presets de `lib/pena-colors.ts`
    — no dejes que llegue ahí texto libre del usuario.

---

## 6. Reglas de trabajo

- **Git:** el agente NO commitea ni pushea salvo petición explícita del usuario.
  Cuando se autorice: `git add <fichero concreto>`, nunca `git add .`.
  Prohibido: force-push, reescribir historial, crear/borrar ramas o tags.
  Push a `main` despliega en Vercel — piénsalo antes.
- **NO tocar sin permiso:** las keys/namespace de Redis (`fiesta:*`) — hay
  datos reales en producción y no hay migraciones; `app/api/debug/**`;
  `components/ui/**` (generado por shadcn); los sprites de `public/`.
- **Si cambias el schema de un objeto en Redis**, actualiza a la vez el schema
  Zod de `app/actions.ts` y los componentes que lo consumen. No hay migración
  automática: los datos viejos seguirán ahí con la forma antigua.
- **Secretos:** nunca los imprimas, comitees ni los saques de `.env.local` /
  las env vars de Vercel. `.gitignore` ya bloquea `.env*` — no lo debilites.
  Claves en juego: `UPSTASH_REDIS_REST_URL`/`TOKEN`, `ADMIN_PASSWORD`,
  `BLOB_READ_WRITE_TOKEN`.
- **Verifica antes de dar por hecho un cambio:** `npx tsc --noEmit` y
  `npm run lint` (no hay tests que te cubran).
- **Ante cualquier duda, pregunta.** No inventes rutas, keys ni comandos.
- **Mantén un LEARNINGS.md con 1 línea por bug/aprendizaje resuelto.**
