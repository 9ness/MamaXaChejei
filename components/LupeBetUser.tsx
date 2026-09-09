'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Coins } from 'lucide-react';
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
        <div className="rounded-lg border bg-card px-3 py-2 mb-4">
            {editando ? (
                <div className="flex items-center gap-2">
                    <Input
                        autoFocus
                        value={borrador}
                        maxLength={24}
                        placeholder="Como te chaman"
                        aria-label="O teu nome"
                        onChange={(e) => setBorrador(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') gardar(); }}
                        className="h-8"
                    />
                    <Button size="sm" className="h-8" onClick={gardar} disabled={borrador.trim().length < 2}>
                        <Check className="w-4 h-4" />
                    </Button>
                </div>
            ) : (
                // Una línea y nada de avatar: esto no es un perfil, es el nombre
                // con el que apuestas y sales en la clasificación.
                <div className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        Xogas como{' '}
                        <button
                            type="button"
                            onClick={() => { setBorrador(nome); setEditando(true); }}
                            className="font-bold text-foreground underline decoration-dotted underline-offset-2"
                        >
                            {nome || 'ponte un nome'}
                        </button>
                    </span>

                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 px-2.5 py-1 text-xs font-bold tabular-nums">
                        <Coins className="w-3.5 h-3.5" />
                        {saldo === null ? '…' : saldo}
                    </span>
                </div>
            )}

            {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
        </div>
    );
}
