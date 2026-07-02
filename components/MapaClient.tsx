'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import type * as L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Radio, Loader2, Users, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { shareLocation, getLocations, removeLocation } from '@/app/actions';

// 📍 Campo da festa (Rianxo). Ajusta estas coordenadas cuando confirmes el punto exacto.
const FESTA = { lat: 42.6486, lng: -8.8156, label: 'Campo da festa' };

const DURACIONES = [
    { label: '15 min', secs: 900 },
    { label: '30 min', secs: 1800 },
    { label: '1 h', secs: 3600 },
];

const COLORES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

function getAnonId(): string {
    let id = localStorage.getItem('anon_id');
    if (!id) {
        id = (crypto.randomUUID?.() ?? String(Math.random()).slice(2));
        localStorage.setItem('anon_id', id);
    }
    return id;
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

    // Preferencias del usuario
    const [nombre, setNombre] = useState('');
    const [color, setColor] = useState<string>('#3b82f6');
    const [durSecs, setDurSecs] = useState<number>(1800);

    // Estos refs mantienen los valores actuales para el modo "en directo"
    const prefs = useRef({ nombre: '', color: '#3b82f6', durSecs: 1800 });
    useEffect(() => { prefs.current = { nombre, color, durSecs }; }, [nombre, color, durSecs]);

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
            const marker = Lm.circleMarker([p.lat, p.lng], {
                radius: 9,
                color: '#ffffff',
                weight: 2,
                fillColor: p.color || '#3b82f6',
                fillOpacity: 0.95,
            }).addTo(layer);
            if (p.name) {
                marker.bindTooltip(p.name, {
                    permanent: true,
                    direction: 'top',
                    offset: [0, -6],
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

            const map = Lm.map(mapRef.current, { zoomControl: true }).setView([FESTA.lat, FESTA.lng], 16);
            Lm.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap',
            }).addTo(map);

            const festaIcon = Lm.divIcon({
                html: `<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4))">🎪</div>`,
                className: '',
                iconSize: [30, 30],
                iconAnchor: [15, 28],
            });
            Lm.marker([FESTA.lat, FESTA.lng], { icon: festaIcon })
                .addTo(map)
                .bindPopup(`<b>${FESTA.label}</b>`);

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

    const publish = useCallback(async (lat: number, lng: number, recenter = false) => {
        const id = getAnonId();
        const { nombre, color, durSecs } = prefs.current;
        await shareLocation(id, lat, lng, nombre, color, durSecs);
        if (recenter && mapObj.current) mapObj.current.setView([lat, lng], 17);
        await refreshPoints();
    }, [refreshPoints]);

    const persistPrefs = () => {
        localStorage.setItem('chat_username', nombre);
        localStorage.setItem('mapa_color', color);
        localStorage.setItem('mapa_dur', String(durSecs));
    };

    const minutosTexto = () => DURACIONES.find(d => d.secs === durSecs)?.label ?? '30 min';

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
                await publish(pos.coords.latitude, pos.coords.longitude, true);
                setBusy(false);
                setStatus(`✅ Compartiches a túa ubicación durante ${minutosTexto()}.`);
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
            if (watchId.current !== null) {
                navigator.geolocation.clearWatch(watchId.current);
                watchId.current = null;
            }
            setLive(false);
            setStatus('Deixaches de compartir en directo.');
            const id = getAnonId();
            removeLocation(id).then(refreshPoints);
            return;
        }
        if (!('geolocation' in navigator)) {
            setStatus('O teu navegador non soporta xeolocalización.');
            return;
        }
        persistPrefs();
        watchId.current = navigator.geolocation.watchPosition(
            async (pos) => {
                const now = Date.now();
                if (now - lastShare.current < 15000) return; // throttle 15s
                lastShare.current = now;
                await publish(pos.coords.latitude, pos.coords.longitude);
            },
            (err) => {
                setStatus(err.code === err.PERMISSION_DENIED
                    ? '❌ Tes que dar permiso de ubicación no navegador.'
                    : '❌ Erro co GPS.');
                setLive(false);
                if (watchId.current !== null) {
                    navigator.geolocation.clearWatch(watchId.current);
                    watchId.current = null;
                }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
        setLive(true);
        setStatus(`🔴 Compartindo en directo (renóvase cada ${minutosTexto()}). Podes paralo cando queiras.`);
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

            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>{count} {count === 1 ? 'persoa' : 'persoas'} no mapa</span>
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
