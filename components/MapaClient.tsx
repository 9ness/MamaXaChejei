'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import type * as L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Radio, Loader2, Users, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { shareLocation, getLocations, removeLocation } from '@/app/actions';

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

// Orquestas: enfrentadas nos dous extremos da praza (unha ao norte, outra ao sur).
// Coordenadas APROXIMADAS calculadas sobre a foto do mapa; afínanse cos puntos exactos.
const POIS: { lat: number; lng: number; label: string }[] = [
    { lat: 42.65247, lng: -8.81843, label: 'Orquestra (norte)' },
    { lat: 42.65190, lng: -8.81844, label: 'Orquestra (sur)' },
];

const DURACIONES = [
    { label: '15 min', secs: 900 },
    { label: '30 min', secs: 1800 },
    { label: '1 h', secs: 3600 },
];

const COLORES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

const LIVE_THROTTLE_MS = 4000; // en directo: refresca el punto cada ~4s
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

export function MapaClient() {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapObj = useRef<L.Map | null>(null);
    const leafletRef = useRef<typeof L | null>(null);
    const layerRef = useRef<L.LayerGroup | null>(null);
    const watchId = useRef<number | null>(null);
    const lastShare = useRef<number>(0);

    const [count, setCount] = useState(0);
    const [live, setLive] = useState(false);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState<string>('');

    // Compartido puntual: hasta cuándo dura (para cuenta atrás + botón de quitar)
    const [shareUntil, setShareUntil] = useState<number | null>(null);
    const [nowTick, setNowTick] = useState<number>(0);

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

            // Puntos de interés fijos (orquestas, etc.) con icono de palco
            POIS.forEach(poi => {
                const icon = Lm.divIcon({
                    html: `<div style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))">${PALCO_SVG}</div>`,
                    className: '',
                    iconSize: [40, 40],
                    iconAnchor: [20, 38],
                });
                Lm.marker([poi.lat, poi.lng], { icon })
                    .addTo(map)
                    .bindPopup(`<b>${escapeHtml(poi.label)}</b>`);
            });

            layerRef.current = Lm.layerGroup().addTo(map);
            mapObj.current = map;

            setTimeout(() => map.invalidateSize(), 100);
            await refreshPoints();
        })();

        const interval = setInterval(refreshPoints, 15000);
        return () => {
            cancelled = true;
            clearInterval(interval);
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
        await shareLocation(id, lat, lng, nombre, color, ttl, opts.live);
        if (opts.recenter && mapObj.current) mapObj.current.setView([lat, lng], 17);
        await refreshPoints();
    }, [refreshPoints]);

    const stopLive = useCallback((msg?: string) => {
        if (watchId.current !== null) {
            navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
        }
        setLive(false);
        setShareUntil(null);
        clearSession();
        const id = getAnonId();
        removeLocation(id).then(refreshPoints);
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

    const persistPrefs = () => {
        localStorage.setItem('chat_username', nombre);
        localStorage.setItem('mapa_color', color);
        localStorage.setItem('mapa_dur', String(durSecs));
    };

    const minutosTexto = () => DURACIONES.find(d => d.secs === durSecs)?.label ?? '30 min';

    const stopShare = () => {
        const id = getAnonId();
        removeLocation(id).then(refreshPoints);
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
                <div className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/25 rounded-xl px-3 py-2.5 animate-in fade-in slide-in-from-top-1">
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
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={live ? () => stopLive('Deixaches de compartir en directo.') : stopShare}
                        className="shrink-0"
                    >
                        Deixar de compartir
                    </Button>
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

            <div
                ref={mapRef}
                className="w-full h-[55vh] min-h-[340px] rounded-xl border shadow-sm overflow-hidden z-0"
            />

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                🔒 Privado da peña: só se garda o teu punto (co nome que ti elixas) e desaparece só ao rematar o tempo. Se non pos nome, o teu punto é anónimo.
            </p>
        </div>
    );
}
