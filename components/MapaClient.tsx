'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import type * as L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Radio, Loader2, Users, Check, Share2, LocateFixed, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { shareLocation, getLocations, removeLocation, gardarLugar, borrarLugar } from '@/app/actions';
import {
    EMOJIS_LUGAR,
    LUGARES_BASE,
    basePorId,
    lugaresColocados,
    mapsUrl,
    type LugarBase,
    type LugaresGardados,
} from '@/lib/lugares';
import { pedirRefresco, publicarAvisos, lerAvisos } from '@/lib/avisos';

// 📍 Recinto da festa: Praza de Castelao (Rianxo). Centro del mapa.
// Ancla fiable: Concello de Rianxo = 42.65190, -8.81830 (dirección: Praza Castelao).
const FESTA = { lat: 42.6522, lng: -8.8184, label: 'Praza de Castelao' };

// Icono SVG de "palco de orquesta de verbena" (escenario con teito e fondo).
const PALCO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 48 48">
  <path d="M4 21 L24 8 L44 21 Z" fill="#c81e3a"/>
  <rect x="5" y="19.5" width="38" height="3" rx="1.5" fill="#a3172d"/>
  <rect x="8" y="22" width="3" height="15" fill="#5b3a21"/>
  <rect x="37" y="22" width="3" height="15" fill="#5b3a21"/>
  <rect x="11" y="22" width="26" height="14" fill="#ffd24a"/>
  <g fill="#7c2d12">
    <circle cx="21" cy="31" r="2.1"/>
    <rect x="22.5" y="24.5" width="1.4" height="6.5"/>
    <path d="M22.5 24.5c3 0 4 1 4 2.6c-1.4-1-3-.9-4-.6z"/>
  </g>
  <rect x="4.5" y="36" width="39" height="5.5" rx="1.5" fill="#374151"/>
  <rect x="4.5" y="36" width="39" height="2" rx="1" fill="#4b5563"/>
</svg>`;

// Cangrexo de festa: marca un campo de festas distinto (p.ex. Taragoña) para
// que non se confunda co palco de orquestra nin cos puntos da xente.
const CANGREXO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 48 48">
  <g stroke="#b91c1c" stroke-width="2.2" stroke-linecap="round" fill="none">
    <path d="M9 20 L2 13"/><path d="M39 20 L46 13"/>
    <path d="M11 34 L5 39"/><path d="M14 37 L10 43"/>
    <path d="M37 34 L43 39"/><path d="M34 37 L38 43"/>
  </g>
  <ellipse cx="9" cy="12" rx="3.4" ry="4.4" fill="#ef4444" stroke="#b91c1c" stroke-width="1.6"/>
  <ellipse cx="39" cy="12" rx="3.4" ry="4.4" fill="#ef4444" stroke="#b91c1c" stroke-width="1.6"/>
  <ellipse cx="24" cy="27" rx="19" ry="14" fill="#ef4444" stroke="#b91c1c" stroke-width="2"/>
  <circle cx="17" cy="23" r="3" fill="#fff"/><circle cx="17" cy="23" r="1.4" fill="#111"/>
  <circle cx="31" cy="23" r="3" fill="#fff"/><circle cx="31" cy="23" r="1.4" fill="#111"/>
  <path d="M18 32c3 2.4 9 2.4 12 0" stroke="#7f1d1d" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <g fill="#facc15"><circle cx="6" cy="4" r="2"/><circle cx="24" cy="1" r="2"/><circle cx="42" cy="4" r="2"/></g>
  <g fill="#a855f7"><circle cx="14" cy="2.5" r="1.6"/><circle cx="34" cy="2.5" r="1.6"/></g>
</svg>`;

type Poi = { lat: number; lng: number; label: string; icon?: string; size?: number };

// Orquestas: enfrentadas nos dous extremos da praza (unha ao norte, outra ao sur).
// Coordenadas APROXIMADAS calculadas sobre a foto do mapa; afínanse cos puntos exactos.
const POIS: Poi[] = [
    { lat: 42.65247, lng: -8.81843, label: 'Orquestra (norte)' },
    { lat: 42.65190, lng: -8.81844, label: 'Orquestra (sur)' },
    // Campo de festas de Taragoña (Campo Maneiro), preto de Rianxo.
    { lat: 42.68390, lng: -8.82525, label: 'Festas de Taragoña · Campo Maneiro', icon: CANGREXO_SVG },
];

const DURACIONES = [
    { label: '15 min', secs: 900 },
    { label: '30 min', secs: 1800 },
    { label: '1 h', secs: 3600 },
];

const COLORES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

// En directo cada 8 s y no cada 4: son dos comandos de Redis por escritura y se
// paga por comando. A pie, en 8 s te mueves 10 metros; en el mapa no se nota.
const LIVE_THROTTLE_MS = 8000;
const LIVE_WRITE_TTL = 60;     // segundos que sobrevive el punto sin actualizarse (red de seguridad)

// Sesión de compartido persistida: sobrevive a recargas de página.
const SESSION_KEY = 'mapa_share';
type ShareSession = { until: number; live: boolean };

function loadSession(): ShareSession | null {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw) as ShareSession;
        if (s && typeof s.until === 'number' && s.until > Date.now()) return s;
    } catch { /* ignore */ }
    return null;
}
function saveSession(s: ShareSession) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

function getAnonId(): string {
    let id = localStorage.getItem('anon_id');
    if (!id) {
        id = (crypto.randomUUID?.() ?? String(Math.random()).slice(2));
        localStorage.setItem('anon_id', id);
    }
    return id;
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
    ));
}

function relTime(ts?: number): string {
    if (!ts) return '';
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `hai ${mins} min`;
    const h = Math.floor(mins / 60);
    return `hai ${h} h`;
}

function fmtRestante(ms: number): string {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${String(ss).padStart(2, '0')}`;
}

interface MapaClientProps {
    /** Só o admin pode mover as chinchetas dos sitios do programa. */
    isAdmin?: boolean;
    /** Onde cae cada sitio, xa lido en servidor (app/mapa/page.tsx). */
    lugaresIniciais?: LugaresGardados;
}

export function MapaClient({ isAdmin = false, lugaresIniciais = {} }: MapaClientProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapObj = useRef<L.Map | null>(null);
    const leafletRef = useRef<typeof L | null>(null);
    const layerRef = useRef<L.LayerGroup | null>(null);
    const targetRef = useRef<L.Marker | null>(null);
    // Chinchetas dos sitios do programa: capa propia porque se redebuxan cada
    // vez que o admin move unha, e o índice por id para poder abrir a de
    // /mapa?lugar=…
    const lugaresLayer = useRef<L.LayerGroup | null>(null);
    const lugaresRef = useRef<Map<string, L.Marker>>(new Map());
    const xaCentrado = useRef(false);   // /mapa?lugar=… céntrase unha soa vez
    const targetPos = useRef<{ lat: number; lng: number } | null>(null);
    const watchId = useRef<number | null>(null);
    const xaEnDirecto = useRef(false);
    const ultimoConteo = useRef(0);
    const compartindo = useRef(false);
    const lastShare = useRef<number>(0);
    const lastPos = useRef<{ lat: number; lng: number } | null>(null);

    const [count, setCount] = useState(0);
    const [mapReady, setMapReady] = useState(false);
    const [live, setLive] = useState(false);
    const [busy, setBusy] = useState(false);
    const [locating, setLocating] = useState(false);
    const [status, setStatus] = useState<string>('');

    // Compartido puntual: hasta cuándo dura (para cuenta atrás + botón de quitar)
    const [shareUntil, setShareUntil] = useState<number | null>(null);
    const [nowTick, setNowTick] = useState<number>(0);

    // --- Sitios do programa (só os toca o admin) ---
    const [lugares, setLugares] = useState<LugaresGardados>(lugaresIniciais);
    const [editando, setEditando] = useState(false);
    const [seleccion, setSeleccion] = useState<string | null>(null);
    // Chincheta provisional: onde quedaría o sitio se gardases agora.
    const [borrador, setBorrador] = useState<{ lat: number; lng: number } | null>(null);
    const [emojiSel, setEmojiSel] = useState<string>('📍');
    const [gardando, setGardando] = useState(false);

    // Preferencias del usuario
    const [nombre, setNombre] = useState('');
    const [color, setColor] = useState<string>('#3b82f6');
    const [durSecs, setDurSecs] = useState<number>(1800);

    // Estos refs mantienen los valores actuales para el modo "en directo"
    const prefs = useRef({ nombre: '', color: '#3b82f6', durSecs: 1800 });
    useEffect(() => { prefs.current = { nombre, color, durSecs }; }, [nombre, color, durSecs]);

    const liveRef = useRef(false);
    useEffect(() => { liveRef.current = live; }, [live]);

    // Cuenta atrás del tiempo compartido (puntual)
    useEffect(() => {
        if (shareUntil === null) return;
        setNowTick(Date.now());
        const t = setInterval(() => {
            const n = Date.now();
            setNowTick(n);
            if (n >= shareUntil) {
                if (liveRef.current) {
                    stopLive('⌛ Rematou o tempo de compartido en directo.');
                } else {
                    setShareUntil(null);
                    clearSession();
                    setStatus('⌛ Rematou o tempo. O teu punto xa non se ve.');
                    refreshPoints();
                }
            }
        }, 1000);
        return () => clearInterval(t);
        // refreshPoints/stopLive son estables (useCallback)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shareUntil]);

    // Cargar preferencias guardadas
    useEffect(() => {
        setNombre(localStorage.getItem('chat_username') || '');
        const c = localStorage.getItem('mapa_color');
        if (c) setColor(c);
        const d = Number(localStorage.getItem('mapa_dur'));
        if (DURACIONES.some(x => x.secs === d)) setDurSecs(d);
    }, []);

    const refreshPoints = useCallback(async () => {
        const Lm = leafletRef.current;
        const map = mapObj.current;
        const layer = layerRef.current;
        if (!Lm || !map || !layer) return;
        const points = await getLocations();
        ultimoConteo.current = points.length;
        // El menú no necesita preguntar por su cuenta mientras estás en el mapa:
        // se lo decimos nosotros, que acabamos de mirarlo.
        publicarAvisos({ ...lerAvisos(), ubicacions: points.length });
        layer.clearLayers();
        points.forEach(p => {
            const dotColor = p.color || '#3b82f6';
            const icon = Lm.divIcon({
                html: `<div class="mxc-marker ${p.live ? 'is-live' : ''}" style="--dot:${escapeHtml(dotColor)}"><span class="mxc-dot"></span></div>`,
                className: '',
                iconSize: [18, 18],
                iconAnchor: [9, 9],
            });
            const marker = Lm.marker([p.lat, p.lng], { icon }).addTo(layer);

            const rel = relTime(p.ts);
            const tip = `${p.name ? `<span class="mxc-name">${escapeHtml(p.name)}</span>` : ''}${rel ? `<span class="mxc-time">${rel}</span>` : ''}`;
            if (tip) {
                marker.bindTooltip(tip, {
                    permanent: true,
                    direction: 'top',
                    offset: [0, -8],
                    className: 'mxc-tooltip',
                });
            }
        });

        // Si el punto del enlace (?p=) coincide con un punto real ya en el mapa,
        // quita el pin del enlace para no verlo duplicado (el real se actualiza).
        if (targetRef.current && targetPos.current) {
            const t = targetPos.current;
            const dup = points.some(p => map.distance([p.lat, p.lng], [t.lat, t.lng]) < 30);
            if (dup) {
                targetRef.current.remove();
                targetRef.current = null;
            }
        }

        setCount(points.length);
    }, []);

    // Inicializa el mapa (solo en cliente)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const mod = await import('leaflet');
            const Lm = (((mod as unknown as { default?: typeof import('leaflet') }).default) ?? mod) as typeof import('leaflet');
            if (cancelled || !mapRef.current || mapObj.current) return;
            leafletRef.current = Lm;

            const map = Lm.map(mapRef.current, { zoomControl: true }).setView([FESTA.lat, FESTA.lng], 17);
            Lm.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap',
            }).addTo(map);

            // Puntos de interés fijos (orquestas, campos de festas, etc.)
            POIS.forEach(poi => {
                const size = poi.size ?? 40;
                const icon = Lm.divIcon({
                    html: `<div style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))">${poi.icon ?? PALCO_SVG}</div>`,
                    className: '',
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size - 2],
                });
                Lm.marker([poi.lat, poi.lng], { icon })
                    .addTo(map)
                    .bindPopup(`<b>${escapeHtml(poi.label)}</b>`);
            });

            // Os sitios do programa van na súa propia capa: redebúxanse cada
            // vez que o admin move unha chincheta (ver o efecto de máis abaixo).
            lugaresLayer.current = Lm.layerGroup().addTo(map);

            layerRef.current = Lm.layerGroup().addTo(map);
            mapObj.current = map;
            setMapReady(true);

            setTimeout(() => map.invalidateSize(), 100);
            await refreshPoints();
        })();

        // Con la pestaña en segundo plano no se consulta nada: si nadie mira,
        // no se gasta. Y si el mapa está vacío y tú tampoco compartes, se mira
        // la mitad de veces: no hay nada que se mueva.
        let vez = 0;
        const tick = () => {
            if (document.visibilityState !== 'visible') return;
            vez++;
            if (ultimoConteo.current === 0 && !compartindo.current && vez % 2 === 1) return;
            refreshPoints();
        };
        const interval = setInterval(tick, 15000);
        document.addEventListener('visibilitychange', tick);
        return () => {
            cancelled = true;
            clearInterval(interval);
            document.removeEventListener('visibilitychange', tick);
            if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
            mapObj.current?.remove();
            mapObj.current = null;
        };
    }, [refreshPoints]);

    const publish = useCallback(async (lat: number, lng: number, opts: { recenter?: boolean; live?: boolean } = {}) => {
        const id = getAnonId();
        const { nombre, color, durSecs } = prefs.current;
        // En directo el punto se reescribe cada pocos segundos con TTL corto;
        // el puntual usa el TTL completo (15/30/60 min).
        const ttl = opts.live ? LIVE_WRITE_TTL : durSecs;
        lastPos.current = { lat, lng };
        compartindo.current = true;
        await shareLocation(id, lat, lng, nombre, color, ttl, opts.live);
        pedirRefresco(); // que a insignia do menú se entere xa
        if (opts.recenter && mapObj.current) mapObj.current.setView([lat, lng], 17);

        // En directo NO se releen los puntos en cada latido: sería doblar el
        // gasto para ver lo mismo. Ya los relee el refresco de 15 s. Solo la
        // primera vez, para que tu punto aparezca al momento.
        if (!opts.live || !xaEnDirecto.current) {
            xaEnDirecto.current = Boolean(opts.live);
            await refreshPoints();
        }
    }, [refreshPoints]);

    const stopLive = useCallback((msg?: string) => {
        if (watchId.current !== null) {
            navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
        }
        xaEnDirecto.current = false;   // ao volver a empezar, refresco inmediato
        compartindo.current = false;
        setLive(false);
        setShareUntil(null);
        clearSession();
        const id = getAnonId();
        removeLocation(id).then(() => { refreshPoints(); pedirRefresco(); });
        if (msg) setStatus(msg);
    }, [refreshPoints]);

    // Arranca (o reanuda) el seguimiento en directo. Reutilizable en toggle y al recargar.
    const startLiveWatch = useCallback(() => {
        if (!('geolocation' in navigator)) {
            setStatus('O teu navegador non soporta xeolocalización.');
            return false;
        }
        lastShare.current = 0; // publicar en canto haxa fix
        watchId.current = navigator.geolocation.watchPosition(
            async (pos) => {
                const now = Date.now();
                if (now - lastShare.current < LIVE_THROTTLE_MS) return; // refresca cada ~4s
                lastShare.current = now;
                await publish(pos.coords.latitude, pos.coords.longitude, { live: true });
            },
            (err) => {
                stopLive(err.code === err.PERMISSION_DENIED
                    ? '❌ Tes que dar permiso de ubicación no navegador.'
                    : '❌ Erro co GPS.');
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
        );
        setLive(true);
        return true;
    }, [publish, stopLive]);

    // Al recargar la página: retomar la sesión de compartido si sigue activa.
    useEffect(() => {
        const s = loadSession();
        if (!s) return;
        setShareUntil(s.until);
        if (s.live) {
            startLiveWatch();
            setStatus('🔴 Retomando o directo…');
        } else {
            const mins = Math.max(1, Math.ceil((s.until - Date.now()) / 60000));
            setStatus(`📍 Ubicación compartida activa (~${mins} min restantes).`);
        }
        // solo al montar
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Enlace compartido: /mapa?p=lat,lng&n=nombre → centra y marca ese punto.
    useEffect(() => {
        if (!mapReady) return;
        const Lm = leafletRef.current;
        const map = mapObj.current;
        if (!Lm || !map || targetRef.current) return;
        const sp = new URLSearchParams(window.location.search);
        const p = sp.get('p');
        if (!p) return;
        const [la, ln] = p.split(',').map(Number);
        if (!isFinite(la) || !isFinite(ln)) return;
        const nm = sp.get('n') || '';
        const icon = Lm.divIcon({
            html: `<div class="mxc-target">📍</div>`,
            className: '',
            iconSize: [40, 40],
            iconAnchor: [20, 38],
        });
        targetPos.current = { lat: la, lng: ln };
        const m = Lm.marker([la, ln], { icon, zIndexOffset: 1000 }).addTo(map);
        m.bindTooltip(nm ? escapeHtml(nm) : 'Aquí', {
            permanent: true,
            direction: 'top',
            offset: [0, -34],
            className: 'mxc-tooltip',
        });
        targetRef.current = m;
        map.setView([la, ln], 18);
        setStatus(nm
            ? `📍 ${nm} compartiu a súa ubicación aquí.`
            : '📍 Alguén da peña compartiu a súa ubicación aquí.');
        refreshPoints(); // por si el punto real ya está: dedupe inmediato
    }, [mapReady, refreshPoints]);

    /** Escoller un sitio para colocalo: se xa estaba posto, vaise a el. */
    const escollerSitio = useCallback((id: string) => {
        const base = basePorId(id);
        const posto = lugares[id];
        setSeleccion(id);
        setBorrador(posto ? { lat: posto.lat, lng: posto.lng } : null);
        setEmojiSel(posto?.emoji ?? base?.emoji ?? '📍');
        if (posto) {
            mapObj.current?.setView([posto.lat, posto.lng], 18);
            setStatus(`✏️ ${base?.nome}: toca noutro punto ou arrastra a chincheta.`);
        } else {
            setStatus(`👆 Toca no mapa onde cae ${base?.nome}.`);
        }
    }, [lugares]);

    // Debuxa as chinchetas dos sitios. Vai nun efecto propio (e non no arranque
    // do mapa) porque o admin móveas en vivo: cada cambio redebuxa a capa.
    useEffect(() => {
        const Lm = leafletRef.current;
        const capa = lugaresLayer.current;
        if (!mapReady || !Lm || !capa) return;

        capa.clearLayers();
        lugaresRef.current.clear();

        // O emoji vai dentro do HTML da chincheta: escápase igual que os nomes.
        const chincheta = (emoji: string, extra = '') => Lm.divIcon({
            html: `<div class="mxc-lugar ${extra}">${escapeHtml(emoji)}</div>`,
            className: '',
            iconSize: [32, 32],
            iconAnchor: [16, 30],
        });

        lugaresColocados(lugares).forEach(lugar => {
            // O que se está a mover agora sae como borrador, non como fixo.
            if (editando && seleccion === lugar.id && borrador) return;
            const marker = Lm.marker([lugar.lat, lugar.lng], { icon: chincheta(lugar.emoji) }).addTo(capa);
            if (editando) {
                // En modo edición a chincheta non abre ficha: escóllese para movela.
                // Hai que cortar o evento: en Leaflet o clic nun marcador tamén
                // chega ao mapa, e o mapa colocaría aí o sitio que estaba escollido.
                marker.on('click', (e) => {
                    Lm.DomEvent.stopPropagation(e);
                    escollerSitio(lugar.id);
                });
            } else {
                marker.bindPopup(
                    `<b>${escapeHtml(lugar.nome)}</b><br/>` +
                    `<a href="${mapsUrl(lugar)}" target="_blank" rel="noopener noreferrer">Ir con Google Maps ↗</a>`,
                );
            }
            lugaresRef.current.set(lugar.id, marker);
        });

        if (editando && seleccion && borrador) {
            const m = Lm.marker([borrador.lat, borrador.lng], {
                icon: chincheta(emojiSel, 'is-borrador'),
                draggable: true,
                zIndexOffset: 900,
            }).addTo(capa);
            m.on('click', (e) => Lm.DomEvent.stopPropagation(e));
            m.on('dragend', () => {
                const { lat, lng } = m.getLatLng();
                setBorrador(b => (b ? { ...b, lat, lng } : b));
            });
            m.bindTooltip(escapeHtml(basePorId(seleccion)?.nome ?? ''), {
                permanent: true,
                direction: 'top',
                offset: [0, -30],
                className: 'mxc-tooltip',
            });
        }
    }, [mapReady, lugares, editando, seleccion, borrador, emojiSel, escollerSitio]);

    // Modo colocar: tocar no mapa pon (ou move) a chincheta do sitio escollido.
    useEffect(() => {
        const map = mapObj.current;
        if (!mapReady || !map || !editando) return;
        const onClick = (e: L.LeafletMouseEvent) => {
            if (!seleccion) {
                setStatus('Escolle primeiro un sitio da lista de abaixo.');
                return;
            }
            setBorrador({ lat: e.latlng.lat, lng: e.latlng.lng });
        };
        map.on('click', onClick);
        return () => { map.off('click', onClick); };
    }, [mapReady, editando, seleccion]);

    // Desde o programa: /mapa?lugar=<id> → centra nese sitio e abre a súa ficha.
    // Espera a ter as chinchetas debuxadas (por iso depende de `lugares`).
    useEffect(() => {
        if (!mapReady || xaCentrado.current) return;
        const map = mapObj.current;
        if (!map) return;
        const id = new URLSearchParams(window.location.search).get('lugar');
        const base = basePorId(id);
        const posto = id ? lugares[id] : undefined;
        if (!base || !posto) return;
        xaCentrado.current = true;
        map.setView([posto.lat, posto.lng], 18);
        lugaresRef.current.get(base.id)?.openPopup();
        setStatus(`${posto.emoji} ${base.nome} · aquí é onde toca.`);
    }, [mapReady, lugares]);

    const gardarSitio = async () => {
        if (!seleccion || !borrador) return;
        setGardando(true);
        const r = await gardarLugar(seleccion, borrador.lat, borrador.lng, emojiSel);
        setGardando(false);
        if (!r.success) {
            setStatus(`❌ ${r.error ?? 'Non se puido gardar o sitio.'}`);
            return;
        }
        const nome = basePorId(seleccion)?.nome ?? 'O sitio';
        setLugares(prev => ({ ...prev, [seleccion]: { ...borrador, emoji: emojiSel } }));
        setSeleccion(null);
        setBorrador(null);
        setStatus(`✅ ${nome} xa está no mapa.`);
    };

    const quitarSitio = async () => {
        if (!seleccion) return;
        setGardando(true);
        const r = await borrarLugar(seleccion);
        setGardando(false);
        if (!r.success) {
            setStatus(`❌ ${r.error ?? 'Non se puido quitar o sitio.'}`);
            return;
        }
        const nome = basePorId(seleccion)?.nome ?? 'O sitio';
        setLugares(prev => {
            const copia = { ...prev };
            delete copia[seleccion];
            return copia;
        });
        setSeleccion(null);
        setBorrador(null);
        setStatus(`🗑️ ${nome} xa non sae no mapa.`);
    };

    // Obtiene la posición actual (para compartir tras recargar, sin punto en memoria).
    const getPos = () => new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            reject,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
        );
    });

    // Comparte por WhatsApp / hoja nativa un enlace al mapa centrado en tu punto.
    const shareWhatsApp = async () => {
        let pos = lastPos.current;
        if (!pos) {
            if (!('geolocation' in navigator)) {
                setStatus('O teu navegador non soporta xeolocalización.');
                return;
            }
            setStatus('Obtendo a túa posición para compartir…');
            try { pos = await getPos(); } catch {
                setStatus('❌ Non se puido obter a ubicación para compartir.');
                return;
            }
        }
        const u = new URL(window.location.origin + '/mapa');
        u.searchParams.set('p', `${pos.lat.toFixed(5)},${pos.lng.toFixed(5)}`);
        if (nombre) u.searchParams.set('n', nombre);
        if (color) u.searchParams.set('c', color);
        const url = u.toString();
        const text = 'Ehh, tou eu aquíí!!! 📍👇';

        if (typeof navigator.share === 'function') {
            try { await navigator.share({ title: 'A miña ubicación', text, url }); } catch { /* cancelado */ }
            return;
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank');
    };

    // Vai á miña ubicación actual no mapa, sen compartir nada con ninguén.
    const handleLocateMe = async () => {
        if (!('geolocation' in navigator)) {
            setStatus('O teu navegador non soporta xeolocalización.');
            return;
        }
        setLocating(true);
        try {
            const pos = await getPos();
            mapObj.current?.setView([pos.lat, pos.lng], 17);
        } catch {
            setStatus('❌ Non se puido obter a túa ubicación.');
        } finally {
            setLocating(false);
        }
    };

    const persistPrefs = () => {
        localStorage.setItem('chat_username', nombre);
        localStorage.setItem('mapa_color', color);
        localStorage.setItem('mapa_dur', String(durSecs));
    };

    const minutosTexto = () => DURACIONES.find(d => d.secs === durSecs)?.label ?? '30 min';

    const stopShare = () => {
        const id = getAnonId();
        removeLocation(id).then(() => { refreshPoints(); pedirRefresco(); });
        setShareUntil(null);
        clearSession();
        setStatus('Deixaches de compartir a túa ubicación.');
    };

    const handleHere = () => {
        if (!('geolocation' in navigator)) {
            setStatus('O teu navegador non soporta xeolocalización.');
            return;
        }
        persistPrefs();
        setBusy(true);
        setStatus('Buscando a túa posición…');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                await publish(pos.coords.latitude, pos.coords.longitude, { recenter: true, live: false });
                setBusy(false);
                const until = Date.now() + durSecs * 1000;
                setShareUntil(until);
                saveSession({ until, live: false });
                setStatus('✅ Ubicación compartida.');
            },
            (err) => {
                setBusy(false);
                setStatus(err.code === err.PERMISSION_DENIED
                    ? '❌ Tes que dar permiso de ubicación no navegador.'
                    : '❌ Non se puido obter a ubicación.');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
    };

    const toggleLive = () => {
        if (live) {
            stopLive('Deixaches de compartir en directo.');
            return;
        }
        persistPrefs();
        const until = Date.now() + durSecs * 1000; // el directo se apaga solo al cumplirse la duración
        if (startLiveWatch()) {
            setShareUntil(until);
            saveSession({ until, live: true });
            setStatus(`🔴 En directo (actualízase cada segundos, párase solo en ${minutosTexto()}).`);
        }
    };

    return (
        <div className="space-y-4">
            {/* Panel de opciones */}
            <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <div
                        className="w-6 h-6 rounded-full shrink-0 border-2 border-white shadow"
                        style={{ backgroundColor: color }}
                    />
                    <Input
                        placeholder="O teu nome (opcional)"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        maxLength={24}
                        className="h-9"
                    />
                </div>

                {/* Color del punto */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Cor</span>
                    <div className="flex gap-2 flex-wrap">
                        {COLORES.map(c => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                aria-label={`Cor ${c}`}
                                className={cn(
                                    "w-7 h-7 rounded-full border-2 transition-transform flex items-center justify-center",
                                    color === c ? "border-slate-800 scale-110" : "border-white shadow"
                                )}
                                style={{ backgroundColor: c }}
                            >
                                {color === c && <Check className="w-4 h-4 text-white drop-shadow" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Duración */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Duración</span>
                    <div className="grid grid-cols-3 gap-2 flex-1 max-w-xs">
                        {DURACIONES.map(d => (
                            <button
                                key={d.secs}
                                onClick={() => setDurSecs(d.secs)}
                                className={cn(
                                    "px-2 py-1.5 rounded-lg text-sm font-semibold border transition-colors",
                                    durSecs === d.secs
                                        ? "bg-primary text-primary-foreground border-transparent"
                                        : "bg-background text-muted-foreground border-slate-200 hover:border-slate-300"
                                )}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <Button onClick={handleHere} disabled={busy} className="flex-1">
                        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MapPin className="w-4 h-4 mr-2" />}
                        Compartir a miña ubicación
                    </Button>
                    <Button onClick={toggleLive} variant={live ? 'destructive' : 'outline'} className="flex-1">
                        <Radio className={`w-4 h-4 mr-2 ${live ? 'animate-pulse' : ''}`} />
                        {live ? 'Parar directo' : 'En directo'}
                    </Button>
                </div>
            </div>

            {/* Compartido activo (puntual): cuenta atrás + quitar */}
            {shareUntil !== null && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-primary/5 border border-primary/25 rounded-xl px-3 py-2.5 animate-in fade-in slide-in-from-top-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                            {live && <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />}
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                        </span>
                        {live ? 'En directo' : 'Compartindo'} · queda{' '}
                        <span className="font-mono font-bold tabular-nums text-primary">
                            {fmtRestante(shareUntil - nowTick)}
                        </span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" onClick={shareWhatsApp} className="gap-1.5">
                            <Share2 className="w-4 h-4" /> Compartir
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={live ? () => stopLive('Deixaches de compartir en directo.') : stopShare}
                        >
                            Quitar
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground px-1">
                <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    {count} {count === 1 ? 'persoa' : 'persoas'} no mapa
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-white shadow-sm" /> puntual
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="relative flex w-2.5 h-2.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-60 animate-ping" />
                        <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-slate-500 border border-white" />
                    </span>
                    en directo
                </span>
            </div>
            {status && (
                <p className="text-xs text-center bg-muted/60 rounded-lg px-3 py-2">{status}</p>
            )}

            {/* Colocar os sitios do programa: só admin. Os nomes veñen do cartel
                (lib/lugares.ts); o que se garda aquí é onde cae cada un. */}
            {isAdmin && (
                <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
                    <button
                        onClick={() => {
                            const novo = !editando;
                            setEditando(novo);
                            setSeleccion(null);
                            setBorrador(null);
                            setStatus(novo ? 'Escolle un sitio e toca no mapa onde cae.' : '');
                        }}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold"
                    >
                        <span className="flex items-center gap-2">
                            <Pencil className="w-4 h-4 text-primary shrink-0" />
                            Colocar os sitios do programa
                        </span>
                        <span className="text-xs font-normal text-muted-foreground tabular-nums shrink-0">
                            {Object.keys(lugares).length}/{LUGARES_BASE.length}
                            {editando ? ' · pechar' : ''}
                        </span>
                    </button>

                    {editando && (
                        <div className="border-t p-3 space-y-3">
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                1️⃣ escolle o sitio · 2️⃣ toca no mapa (ou arrastra a chincheta) · 3️⃣ elixe icona e garda.
                            </p>

                            <div className="flex flex-wrap gap-1.5">
                                {LUGARES_BASE.map((l: LugarBase) => {
                                    const posto = Boolean(lugares[l.id]);
                                    const activo = seleccion === l.id;
                                    return (
                                        <button
                                            key={l.id}
                                            onClick={() => escollerSitio(l.id)}
                                            className={cn(
                                                "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors",
                                                activo
                                                    ? "bg-primary text-primary-foreground border-transparent"
                                                    : posto
                                                        ? "bg-primary/5 text-primary border-primary/30"
                                                        : "bg-background text-muted-foreground border-dashed border-slate-300",
                                            )}
                                        >
                                            <span>{lugares[l.id]?.emoji ?? l.emoji}</span>
                                            {l.nome}
                                            {posto && !activo && <Check className="w-3 h-3 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>

                            {seleccion && (
                                <div className="border-t pt-3 space-y-2.5">
                                    <p className="text-xs font-semibold">
                                        {basePorId(seleccion)?.nome}
                                        <span className="font-normal text-muted-foreground">
                                            {borrador
                                                ? ` · ${borrador.lat.toFixed(5)}, ${borrador.lng.toFixed(5)}`
                                                : ' · toca no mapa'}
                                        </span>
                                    </p>

                                    <div className="flex flex-wrap gap-1">
                                        {EMOJIS_LUGAR.map(e => (
                                            <button
                                                key={e}
                                                onClick={() => setEmojiSel(e)}
                                                aria-label={`Icona ${e}`}
                                                className={cn(
                                                    "w-8 h-8 rounded-lg border text-base leading-none grid place-items-center transition-transform active:scale-95",
                                                    emojiSel === e
                                                        ? "border-primary bg-primary/10 scale-110"
                                                        : "border-slate-200 bg-background",
                                                )}
                                            >
                                                {e}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={gardarSitio}
                                            disabled={!borrador || gardando}
                                            className="flex-1"
                                        >
                                            {gardando
                                                ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                                                : <Check className="w-4 h-4 mr-1.5" />}
                                            Gardar aquí
                                        </Button>
                                        {lugares[seleccion] && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={quitarSitio}
                                                disabled={gardando}
                                                aria-label="Quitar do mapa"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => { setSeleccion(null); setBorrador(null); }}
                                            aria-label="Cancelar"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="relative">
                <div
                    ref={mapRef}
                    className={cn(
                        "w-full h-[55vh] min-h-[340px] rounded-xl border shadow-sm overflow-hidden z-0",
                        // Colocando sitios: a cruz avisa de que tocar pon chincheta.
                        editando && "[&_.leaflet-container]:cursor-crosshair ring-2 ring-primary/40",
                    )}
                />
                <button
                    onClick={handleLocateMe}
                    disabled={locating}
                    aria-label="Ir á miña ubicación"
                    className="absolute bottom-3 right-3 z-[400] w-10 h-10 rounded-full bg-card border shadow-md flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60"
                >
                    {locating
                        ? <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        : <LocateFixed className="w-5 h-5 text-primary" />}
                </button>
            </div>

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                🔒 Privado da peña: só se garda o teu punto (co nome que ti elixas) e desaparece só ao rematar o tempo. Se non pos nome, o teu punto é anónimo.
            </p>
        </div>
    );
}
