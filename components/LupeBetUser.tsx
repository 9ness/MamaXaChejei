'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Coins, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { gardarNomeMoedas, getPerfilMoedas } from '@/app/actions';
import { getAnonId } from '@/lib/anon-id';

/**
 * La barra de "quen es" de la LupeBet: nombre y moedas, como en cualquier casa
 * de apuestas. Sin cuentas: el nombre es el mismo del chat (`chat_username` del
 * navegador) y el saldo va por `anon_id`. Solo se copia el nombre a Redis para
 * que la clasificación pueda pintarlo.
 */
export function LupeBetUser() {
    const router = useRouter();
    const [nome, setNome] = useState('');
    const [saldo, setSaldo] = useState<number | null>(null);
    const [editando, setEditando] = useState(false);
    const [borrador, setBorrador] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        let vivo = true;
        const local = (() => {
            try { return localStorage.getItem('chat_username') || ''; } catch { return ''; }
        })();

        getPerfilMoedas(getAnonId())
            .then(async (r) => {
                if (!vivo) return;
                setSaldo(r.saldo);
                setNome(local || r.nome);
                // Si ya tenía nombre del chat pero Redis no lo sabe, se registra
                // solo: así aparece en la clasificación sin tener que apostar.
                if (local && local !== r.nome) {
                    const res = await gardarNomeMoedas(getAnonId(), local);
                    if (vivo && res.saldo !== undefined) setSaldo(res.saldo);
                }
            })
            .catch(() => { /* se queda en "…" y no molesta */ });

        return () => { vivo = false; };
    }, []);

    const gardar = async () => {
        setError('');
        const limpio = borrador.trim().slice(0, 24);
        const res = await gardarNomeMoedas(getAnonId(), limpio);
        if (res.error) {
            setError(res.error);
            return;
        }
        try { localStorage.setItem('chat_username', limpio); } catch { /* ignore */ }
        setNome(res.nome ?? limpio);
        setSaldo(res.saldo ?? saldo);
        setEditando(false);
        router.refresh();
    };

    return (
        <div className="rounded-xl border bg-card px-3 py-2.5 mb-4">
            <div className="flex items-center gap-3">
                <span
                    aria-hidden
                    className="w-9 h-9 shrink-0 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold"
                >
                    {(nome || '?').trim().charAt(0).toUpperCase()}
                </span>

                {editando ? (
                    <>
                        <Input
                            autoFocus
                            value={borrador}
                            maxLength={24}
                            placeholder="Como te chaman"
                            aria-label="O teu nome"
                            onChange={(e) => setBorrador(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') gardar(); }}
                            className="h-9"
                        />
                        <Button size="sm" onClick={gardar} disabled={borrador.trim().length < 2}>
                            <Check className="w-4 h-4" />
                        </Button>
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => { setBorrador(nome); setEditando(true); }}
                            className="min-w-0 flex-1 text-left group"
                        >
                            <span className="block font-bold truncate group-hover:underline">
                                {nome || 'Ponte un nome'}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                                <Pencil className="inline w-3 h-3 mr-1 mb-0.5" />
                                {nome ? 'Toca para cambialo' : 'Para saír na clasificación'}
                            </span>
                        </button>

                        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 px-3 py-1.5 font-bold tabular-nums">
                            <Coins className="w-4 h-4" />
                            {saldo === null ? '…' : saldo}
                        </span>
                    </>
                )}
            </div>

            {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
        </div>
    );
}
