'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apostar, getMeuEstado } from '@/app/actions';
import { getAnonId } from '@/lib/anon-id';
import {
    type Aposta,
    type ApostasBoleto,
    type EstadoBoleto,
    MAX_APOSTA,
    eur,
    multiplicadorPago,
    type BoletoLinea,
} from '@/lib/lupebet';

const ATALLOS = [10, 25, 50, 100];

interface ApostarPanelProps {
    boletoId: string;
    estado: EstadoBoleto;
    lineas: BoletoLinea[];
    apostas: ApostasBoleto;
}

export function ApostarPanel({ boletoId, estado, lineas, apostas }: ApostarPanelProps) {
    const router = useRouter();
    const [saldo, setSaldo] = useState<number | null>(null);
    const [miAposta, setMiAposta] = useState<Aposta | null>(null);
    const [cantidad, setCantidad] = useState(25);
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);

    useEffect(() => {
        let vivo = true;
        // El anonId solo existe en el navegador, así que esto no puede salir del
        // render del servidor: se pide al montar.
        getMeuEstado(boletoId, getAnonId())
            .then((r) => {
                if (!vivo) return;
                setSaldo(r.saldo);
                setMiAposta(r.aposta);
            })
            .catch(() => { /* se queda en "cargando" y no deja apostar */ });
        return () => { vivo = false; };
    }, [boletoId]);

    const pechado = estado !== 'aberto';
    const mult = multiplicadorPago(lineas);

    const handleApostar = async () => {
        setError('');
        setPending(true);
        const nombre = localStorage.getItem('chat_username') || 'Anónimo';
        const res = await apostar(boletoId, getAnonId(), nombre, cantidad);
        setPending(false);

        if (res.error) {
            setError(res.error);
            return;
        }
        setSaldo(res.saldo ?? null);
        setMiAposta({ nombre, moedas: cantidad, ts: Date.now() });
        router.refresh();
    };

    return (
        <div className="mt-6 rounded-xl border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-bold flex items-center gap-2">
                    <Coins className="w-4 h-4" /> Apostar moedas
                </h3>
                <span className="text-sm text-muted-foreground tabular-nums">
                    {saldo === null ? '…' : `${saldo} moedas`}
                </span>
            </div>

            {pechado ? (
                <p className="text-sm text-muted-foreground">
                    Este boleto xa está pechado: {estado === 'ganado' ? 'saíu gañado 🎉' : 'saíu perdido 💀'}
                </p>
            ) : miAposta ? (
                <p className="text-sm">
                    Xa apostaches <span className="font-bold">{miAposta.moedas} moedas</span>. Se sae
                    gañado levas <span className="font-bold">{Math.round(miAposta.moedas * mult)}</span>.
                </p>
            ) : (
                <>
                    <div className="flex flex-wrap gap-2">
                        {ATALLOS.map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setCantidad(n)}
                                className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${
                                    cantidad === n
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'hover:bg-muted'
                                }`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>

                    <input
                        type="range"
                        min={1}
                        max={Math.max(1, Math.min(MAX_APOSTA, saldo ?? MAX_APOSTA))}
                        value={cantidad}
                        aria-label="Moedas a apostar"
                        onChange={(e) => setCantidad(Number(e.target.value))}
                        className="w-full mt-3 accent-primary"
                    />

                    <p className="text-sm text-muted-foreground mt-2">
                        {cantidad} moedas → se sae gañado levas{' '}
                        <span className="font-bold text-foreground">{Math.round(cantidad * mult)}</span>
                    </p>

                    {error && <p className="text-sm font-medium text-red-500 mt-2">{error}</p>}

                    <Button
                        onClick={handleApostar}
                        disabled={pending || saldo === null || cantidad > (saldo ?? 0)}
                        className="w-full mt-3"
                    >
                        {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {saldo !== null && cantidad > saldo ? 'Non tes moedas dabondo' : `Apostar ${cantidad} moedas`}
                    </Button>
                </>
            )}

            {apostas.apostantes.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                        {apostas.apostantes.length} persoa{apostas.apostantes.length === 1 ? '' : 's'} ·{' '}
                        {eur(apostas.total).replace(',00', '')} moedas en xogo
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                        {apostas.apostantes.map((a, i) => (
                            <li key={i} className="text-xs bg-muted rounded-full px-2.5 py-1">
                                {a.nombre} <span className="font-bold tabular-nums">{a.moedas}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
