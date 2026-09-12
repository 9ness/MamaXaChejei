'use client';

import { useEffect, useState } from 'react';
import { fai } from '@/lib/tempo';

/**
 * Cando se subiu: "fai 38 minutos", e dunha semana en diante, a data.
 * Calcúlase DESPOIS de montar, non no render: o servidor e o móbil non teñen
 * por que coincidir na hora e sairía un aviso de hidratación.
 */
export function Cando({ ts, claro = false }: { ts: number; claro?: boolean }) {
    const [texto, setTexto] = useState('');

    useEffect(() => {
        const pinta = () => setTexto(fai(ts, Date.now()));
        pinta();
        // Cada minuto, para que "agora mesmo" non quede cravado se a pestana
        // queda aberta toda a festa.
        const t = setInterval(pinta, 60_000);
        return () => clearInterval(t);
    }, [ts]);

    if (!texto) return null;
    return <span className={claro ? 'text-white/60' : ''}>{texto}</span>;
}
