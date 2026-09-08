'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBoleto } from '@/app/actions';
import {
    type BoletoLinea,
    MAX_IMPORTE,
    MAX_LINEAS,
    cuotaContraria,
    cuotaDeProbabilidad,
    cuotaTotal,
    eur,
    ganancia,
    probabilidadDeCuota,
} from '@/lib/lupebet';

type LineaDraft = { apuesta: string; pronostico: string; cuota: string };

const LINEA_VACIA: LineaDraft = { apuesta: '', pronostico: '', cuota: '1.50' };

/** Las cuotas a medio escribir ("1." o "") no deben tirar el cálculo. */
function toLineas(drafts: LineaDraft[]): BoletoLinea[] {
    return drafts.map((d) => ({
        apuesta: d.apuesta,
        pronostico: d.pronostico,
        cuota: Number(d.cuota.replace(',', '.')) || 1,
    }));
}

/** El nombre que ya usa en el chat. Con useSyncExternalStore y no con un efecto
 *  porque en el servidor no hay localStorage: así React sabe que el valor del
 *  servidor es "" y lo rehace en cliente sin romper la hidratación. */
function useNombreGuardado() {
    return useSyncExternalStore(
        () => () => {},                                     // no cambia solo
        () => localStorage.getItem('chat_username') || '',  // cliente
        () => '',                                           // servidor
    );
}

function CuotaPicker({
    cuota,
    onCuota,
    linea,
}: {
    cuota: number;
    onCuota: (c: number) => void;
    linea: number;
}) {
    const pct = probabilidadDeCuota(cuota);

    return (
        <div className="rounded-md bg-muted/50 px-3 py-2.5">
            <div className="flex items-end justify-between gap-3">
                <label htmlFor={`prob-${linea}`} className="text-xs font-medium text-muted-foreground">
                    Probabilidade de que pase
                    <span className="block text-base font-bold text-foreground tabular-nums">{pct}%</span>
                </label>
                <div className="text-right">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Cuota
                    </span>
                    <span className="block text-2xl font-extrabold tabular-nums leading-none">
                        {eur(cuota)}
                    </span>
                </div>
            </div>

            <input
                id={`prob-${linea}`}
                type="range"
                min={2}
                max={99}
                value={pct}
                onChange={(e) => onCuota(cuotaDeProbabilidad(Number(e.target.value)))}
                className="w-full mt-2 accent-primary"
            />

            <p className="text-[11px] text-muted-foreground mt-1">
                O contrario pagaría <span className="font-bold">{eur(cuotaContraria(cuota))}</span>
            </p>
        </div>
    );
}

export function BoletoForm() {
    const router = useRouter();
    const nombreGuardado = useNombreGuardado();
    const [nombreEditado, setNombreEditado] = useState<string | null>(null);
    const nombre = nombreEditado ?? nombreGuardado;
    const [titulo, setTitulo] = useState('APUESTA COMBINADA');
    const [importe, setImporte] = useState('10');
    const [lineas, setLineas] = useState<LineaDraft[]>([{ ...LINEA_VACIA }]);
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);

    const patch = (i: number, campo: keyof LineaDraft, valor: string) => {
        setLineas((prev) => prev.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
    };

    const calc = toLineas(lineas);
    const total = cuotaTotal(calc);
    const premio = ganancia(Number(importe.replace(',', '.')) || 0, calc);

    const listo = nombre.trim().length > 0 && lineas.every((l) => l.apuesta.trim().length >= 3);

    const handleSubmit = async () => {
        setError('');
        setPending(true);
        const res = await createBoleto({
            titulo: titulo.trim(),
            nombre: nombre.trim(),
            importe: Number(importe.replace(',', '.')) || 0,
            lineas: calc,
        });
        setPending(false);

        if (res.id) {
            try { localStorage.setItem('chat_username', nombre.trim()); } catch { /* ignore */ }
            router.push(`/lupebet/${encodeURIComponent(res.id)}`);
            router.refresh();
            return;
        }
        setError(res.error ?? 'Non se puido gardar o boleto.');
    };

    return (
        <div className="bg-card border rounded-lg shadow-sm p-4 sm:p-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                    <Label htmlFor="bol-nombre">O teu nome</Label>
                    <Input
                        id="bol-nombre"
                        value={nombre}
                        maxLength={24}
                        placeholder="Como te chaman"
                        onChange={(e) => setNombreEditado(e.target.value)}
                    />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="bol-titulo">Título do boleto</Label>
                    <Input
                        id="bol-titulo"
                        value={titulo}
                        maxLength={40}
                        onChange={(e) => setTitulo(e.target.value)}
                    />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="bol-importe">Importe (€)</Label>
                    <Input
                        id="bol-importe"
                        type="number"
                        inputMode="decimal"
                        min={1}
                        max={MAX_IMPORTE}
                        value={importe}
                        onChange={(e) => setImporte(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-3">
                {lineas.map((l, i) => (
                    <div key={i} className="border rounded-md p-3 space-y-2 bg-background">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                Liña {i + 1}
                            </span>
                            {lineas.length > 1 && (
                                <button
                                    type="button"
                                    aria-label={`Quitar liña ${i + 1}`}
                                    onClick={() => setLineas((prev) => prev.filter((_, j) => j !== i))}
                                    className="text-muted-foreground hover:text-red-600 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <Input
                            value={l.apuesta}
                            maxLength={90}
                            placeholder="Nº de veses que sona a Rianxeira"
                            onChange={(e) => patch(i, 'apuesta', e.target.value)}
                        />
                        <Input
                            value={l.pronostico}
                            maxLength={40}
                            placeholder="Máis de 25'5"
                            onChange={(e) => patch(i, 'pronostico', e.target.value)}
                        />

                        {/* Nadie piensa en cuotas: se elige la probabilidad y la
                            cuota sale sola. La cuota sigue siendo la fuente de
                            verdad, el deslizador es solo la forma de tocarla. */}
                        <CuotaPicker
                            cuota={Number(l.cuota.replace(',', '.')) || 1.5}
                            onCuota={(c) => patch(i, 'cuota', String(c))}
                            linea={i + 1}
                        />
                    </div>
                ))}

                {lineas.length < MAX_LINEAS && (
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setLineas((prev) => [...prev, { ...LINEA_VACIA }])}
                    >
                        <Plus className="w-4 h-4 mr-1" /> Engadir liña
                    </Button>
                )}
            </div>

            <div className="rounded-md bg-muted/60 px-4 py-3 flex items-center justify-between gap-4">
                <div className="text-sm">
                    <span className="font-bold uppercase text-xs text-muted-foreground block">Cuota total</span>
                    <span className="text-lg font-bold tabular-nums">{eur(total)}</span>
                </div>
                <div className="text-right">
                    <span className="font-bold uppercase text-xs text-muted-foreground block">Posible ganancia</span>
                    <span className="text-2xl font-extrabold tabular-nums">{eur(premio)}€</span>
                </div>
            </div>

            {error && <p className="text-sm font-medium text-red-500">{error}</p>}

            <Button onClick={handleSubmit} disabled={!listo || pending} className="w-full" size="lg">
                {pending ? 'Gardando...' : 'Facer o boleto'}
            </Button>
        </div>
    );
}
