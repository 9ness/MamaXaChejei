'use client';

import { useState, useTransition } from 'react';
import { setPenaColor } from '@/app/actions';
import { PENA_PRESETS, type PenaColorKey } from '@/lib/pena-colors';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PenaColorPicker({ current }: { current: string }) {
    const [selected, setSelected] = useState<string>(current);
    const [isPending, startTransition] = useTransition();

    const choose = (key: PenaColorKey) => {
        setSelected(key);
        startTransition(async () => {
            await setPenaColor(key);
        });
    };

    return (
        <div>
            <p className="text-xs text-muted-foreground mb-4">
                Elige el color principal. Se aplica al momento en toda la web (menús, títulos, chat…).
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {Object.values(PENA_PRESETS).map((preset) => {
                    const active = selected === preset.key;
                    return (
                        <button
                            key={preset.key}
                            onClick={() => choose(preset.key)}
                            disabled={isPending}
                            className={cn(
                                "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                                active ? "border-slate-800 ring-2 ring-slate-800 bg-slate-50" : "border-slate-200 hover:border-slate-400",
                                isPending && "opacity-60 cursor-wait"
                            )}
                        >
                            <span
                                className="w-8 h-8 rounded-full shadow-inner flex items-center justify-center"
                                style={{ backgroundColor: preset.swatch }}
                            >
                                {active && <Check className="w-4 h-4 text-white drop-shadow" />}
                            </span>
                            <span className="text-xs font-medium">{preset.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
