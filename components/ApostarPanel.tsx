'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apostar, getMeuEstado } from '@/app/actions';
import { getAnonId } from '@/lib/anon-id';
import {
    type Aposta,
    type ApostasBoleto,
    type BoletoLinea,
    type EstadoBoleto,
    type LadoAposta,
    MAX_APOSTA,
    eur,
    mercadoBoleto,
    multiplicadorAposta,
} from '@/lib/lupebet';

const ATALLOS = [10, 25, 50, 100];

interface ApostarPanelProps {
    boletoId: string;
    estado: EstadoBoleto;
    lineas: BoletoLinea[];
    apostas: ApostasBoleto;
}

/** Flecha de movimiento de la cuota, como en las casas de verdad: verde si
 *  ahora paga más que al salir, roja si la han tirado abajo. */
function Movemento({ ahora, saida }: { ahora: number; saida: number }) {
    const dif = Math.round(((ahora - saida) / saida) * 100);
    if (Math.abs(dif) < 1) {
        return <span className="text-[10px] text-muted-foreground">sen movemento</span>;
    }
    const sube = dif > 0;
    return (
        <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${sube ? 'text-green-600' : 'text-red-600'}`}>
            {sube ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {sube ? '+' : ''}{dif}% · saía a {eur(saida)}
        </span>
    );
}

export function ApostarPanel({ boletoId, estado, lineas, apostas }: ApostarPanelProps) {
    const router = useRouter();
    const [saldo, setSaldo] = useState<number | null>(null);
    const [miAposta, setMiAposta] = useState<Aposta | null>(null);
    const [cantidad, setCantidad] = useState(25);
    const [lado, setLado] = useState<LadoAposta>('si');
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

    // Las cuotas se mueven con las moedas que hay a cada lado, igual que un
    // mercado de verdad. Se calculan aquí solo para pintarlas: la buena la pone
    // el servidor al apostar, y es la que se congela.
    const mercado = mercadoBoleto(lineas, apostas.totalSi, apostas.totalNon);
    const mult = lado === 'si' ? mercado.si : mercado.non;

    const handleApostar = async () => {
        setError('');
        setPending(true);
        const nombre = localStorage.getItem('chat_username') || 'Anónimo';
        const res = await apostar(boletoId, getAnonId(), nombre, cantidad, lado);
        setPending(false);

        if (res.error) {
            setError(res.error);
            return;
        }
        setSaldo(res.saldo ?? null);
        setMiAposta({ nombre, moedas: cantidad, ts: Date.now(), lado, cuota: res.cuota });
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
                    Xa apostaches <span className="font-bold">{miAposta.moedas} moedas</span> a{' '}
                    <span className="font-bold">
                        {(miAposta.lado ?? 'si') === 'si' ? 'que SI sae' : 'que NON sae'}
                    </span>{' '}
                    con cuota <span className="font-bold tabular-nums">×{eur(multiplicadorAposta(miAposta, lineas))}</span>.
                    Se acertas levas{' '}
                    <span className="font-bold">
                        {Math.round(miAposta.moedas * multiplicadorAposta(miAposta, lineas))}
                    </span>
                    .{' '}
                    <span className="text-muted-foreground">
                        A túa cuota xa quedou fixada; a dos demais segue movéndose.
                    </span>
                </p>
            ) : (
                <>
                    {/* Los dos lados: apostar a que el boleto sale, o a que no. La
                        cuota de cada uno se mueve con el dinero de la peña. */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        {([
                            { v: 'si' as const, titulo: 'SI, vai caer', m: mercado.si, base: mercado.baseSi },
                            { v: 'non' as const, titulo: 'NON, nin de broma', m: mercado.non, base: mercado.baseNon },
                        ]).map((op) => (
                            <button
                                key={op.v}
                                type="button"
                                onClick={() => setLado(op.v)}
                                className={`rounded-lg border-2 px-3 py-2 text-left transition-colors ${
                                    lado === op.v
                                        ? 'border-primary bg-primary/10'
                                        : 'border-transparent bg-muted hover:bg-muted/70'
                                }`}
                            >
                                <span className="block text-xs font-bold leading-tight">{op.titulo}</span>
                                <span className="block text-lg font-extrabold tabular-nums leading-tight">
                                    ×{eur(op.m)}
                                </span>
                                <Movemento ahora={op.m} saida={op.base} />
                            </button>
                        ))}
                    </div>

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
                        {cantidad} moedas a que {lado === 'si' ? 'SI' : 'NON'} → se acertas levas{' '}
                        <span className="font-bold text-foreground">{Math.round(cantidad * mult)}</span>
                        <span className="block text-[11px]">
                            Collerías a cuota de agora (×{eur(mult)}) e xa non che cambia.
                        </span>
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
                        <span className="text-green-700">{apostas.totalSi} a favor</span> ·{' '}
                        <span className="text-red-700">{apostas.totalNon} en contra</span>
                    </p>

                    {/* Cómo está repartido el dinero: es lo que mueve la cuota. */}
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-muted mb-2">
                        <div
                            className="bg-green-500"
                            style={{ width: `${(apostas.totalSi / Math.max(1, apostas.total)) * 100}%` }}
                        />
                        <div
                            className="bg-red-500"
                            style={{ width: `${(apostas.totalNon / Math.max(1, apostas.total)) * 100}%` }}
                        />
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-2">
                        A peña dálle un <span className="font-bold">{mercado.prob}%</span> de que saia.
                    </p>

                    <ul className="flex flex-wrap gap-1.5">
                        {apostas.apostantes.map((a, i) => (
                            <li
                                key={i}
                                className={`text-xs rounded-full px-2.5 py-1 ${
                                    (a.lado ?? 'si') === 'si'
                                        ? 'bg-green-100 text-green-900'
                                        : 'bg-red-100 text-red-900'
                                }`}
                            >
                                {a.nombre} <span className="font-bold tabular-nums">{a.moedas}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
