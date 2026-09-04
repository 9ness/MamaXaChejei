'use client';

import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PinPadProps {
    value: string;
    onChange: (value: string) => void;
    length: number;
    disabled?: boolean;
    /** Sacude los puntos cuando el PIN falla. */
    shake?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Teclado numérico controlado. El padre decide qué hacer cuando `value` llega a
 * `length` — aquí solo se teclea. Sin <input>: en móvil no queremos que salte el
 * teclado del sistema encima del panel.
 */
export function PinPad({ value, onChange, length, disabled = false, shake = false }: PinPadProps) {
    const push = (digit: string) => {
        if (disabled || value.length >= length) return;
        onChange(value + digit);
    };

    const back = () => {
        if (disabled) return;
        onChange(value.slice(0, -1));
    };

    return (
        <div className="space-y-6">
            <div className={cn('flex justify-center gap-3', shake && 'animate-shake')}>
                {Array.from({ length }).map((_, i) => (
                    <span
                        key={i}
                        className={cn(
                            'w-3.5 h-3.5 rounded-full border-2 transition-colors',
                            i < value.length
                                ? 'bg-primary border-primary'
                                : 'border-muted-foreground/40'
                        )}
                    />
                ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
                {KEYS.map((k) => (
                    <button
                        key={k}
                        type="button"
                        onClick={() => push(k)}
                        disabled={disabled}
                        className="h-14 rounded-xl border bg-background text-xl font-semibold tabular-nums transition-colors hover:bg-muted active:bg-muted disabled:opacity-40"
                    >
                        {k}
                    </button>
                ))}
                <span />
                <button
                    type="button"
                    onClick={() => push('0')}
                    disabled={disabled}
                    className="h-14 rounded-xl border bg-background text-xl font-semibold tabular-nums transition-colors hover:bg-muted active:bg-muted disabled:opacity-40"
                >
                    0
                </button>
                <button
                    type="button"
                    onClick={back}
                    disabled={disabled || value.length === 0}
                    aria-label="Borrar"
                    className="h-14 rounded-xl border bg-background flex items-center justify-center text-muted-foreground transition-colors hover:bg-muted active:bg-muted disabled:opacity-40"
                >
                    <Delete className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
