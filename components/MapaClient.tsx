'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import type * as L from 'leaflet';
import { Button } from '@/components/ui/button';
import { MapPin, Radio, Loader2, Users } from 'lucide-react';
import { shareLocation, getLocations, removeLocation } from '@/app/actions';

// 📍 Campo da festa (Rianxo). Ajusta estas coordenadas cuando confirmes el punto exacto.
const FESTA = { lat: 42.6486, lng: -8.8156, label: 'Campo da festa' };

function getAnonId(): string {
    let id = localStorage.getItem('anon_id');
    if (!id) {
        id = (crypto.randomUUID?.() ?? String(Math.random()).slice(2));
        localStorage.setItem('anon_id', id);
    }
    return id;
}

function penaColor(): string {
    if (typeof window === 'undefined') return 'hsl(142 72% 38%)';
    const v = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    return v ? `hsl(${v})` : 'hsl(142 72% 38%)';
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

    const refreshPoints = useCallback(async () => {
        const L = leafletRef.current;
        const map = mapObj.current;
        const layer = layerRef.current;
        if (!L || !map || !layer) return;
        const points = await getLocations();
        layer.clearLayers();
        const color = penaColor();
        points.forEach(p => {
            L.circleMarker([p.lat, p.lng], {
                radius: 8,
                color: '#ffffff',
                weight: 2,
                fillColor: color,
                fillOpacity: 0.9,
            }).addTo(layer);
        });
        setCount(points.length);
    }, []);

    // Inicializa el mapa (solo en cliente)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const mod = await import('leaflet');
            const L = (((mod as unknown as { default?: typeof import('leaflet') }).default) ?? mod) as typeof import('leaflet');
            if (cancelled || !mapRef.current || mapObj.current) return;
            leafletRef.current = L;

            const map = L.map(mapRef.current, { zoomControl: true }).setView([FESTA.lat, FESTA.lng], 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap',
            }).addTo(map);

            // Marcador del campo da festa
            const festaIcon = L.divIcon({
                html: `<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.4))">🎪</div>`,
                className: '',
                iconSize: [30, 30],
                iconAnchor: [15, 28],
            });
            L.marker([FESTA.lat, FESTA.lng], { icon: festaIcon })
                .addTo(map)
                .bindPopup(`<b>${FESTA.label}</b>`);

            layerRef.current = L.layerGroup().addTo(map);
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
        await shareLocation(id, lat, lng);
        if (recenter && mapObj.current) mapObj.current.setView([lat, lng], 17);
        await refreshPoints();
    }, [refreshPoints]);

    const handleHere = () => {
        if (!('geolocation' in navigator)) {
            setStatus('O teu navegador non soporta xeolocalización.');
            return;
        }
        setBusy(true);
        setStatus('Buscando a túa posición…');
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                await publish(pos.coords.latitude, pos.coords.longitude, true);
                setBusy(false);
                setStatus('✅ Compartiches a túa posición (caduca en 8 h).');
            },
            (err) => {
                setBusy(false);
                setStatus(err.code === err.PERMISSION_DENIED
                    ? '❌ Tes que dar permiso de ubicación.'
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
        watchId.current = navigator.geolocation.watchPosition(
            async (pos) => {
                const now = Date.now();
                if (now - lastShare.current < 15000) return; // throttle 15s
                lastShare.current = now;
                await publish(pos.coords.latitude, pos.coords.longitude);
            },
            (err) => {
                setStatus(err.code === err.PERMISSION_DENIED
                    ? '❌ Tes que dar permiso de ubicación.'
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
        setStatus('🔴 Compartindo en directo. Podes paralo cando queiras.');
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleHere} disabled={busy} className="flex-1">
                    {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MapPin className="w-4 h-4 mr-2" />}
                    Estou aquí
                </Button>
                <Button
                    onClick={toggleLive}
                    variant={live ? 'destructive' : 'outline'}
                    className="flex-1"
                >
                    <Radio className={`w-4 h-4 mr-2 ${live ? 'animate-pulse' : ''}`} />
                    {live ? 'Parar directo' : 'Compartir en directo'}
                </Button>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {count} {count === 1 ? 'persoa' : 'persoas'} no mapa
                </span>
                {status && <span className="truncate ml-2">{status}</span>}
            </div>

            <div
                ref={mapRef}
                className="w-full h-[60vh] min-h-[360px] rounded-xl border shadow-sm overflow-hidden z-0"
            />

            <p className="text-[11px] text-muted-foreground text-center">
                🔒 Privado: só se garda un punto anónimo (sen nome) que caduca automaticamente. Ninguén sabe de quen é cada punto.
            </p>
        </div>
    );
}
