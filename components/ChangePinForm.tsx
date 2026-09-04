'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePin } from '@/app/admin/actions';
import { PIN_LENGTH, PIN_REGEX } from '@/lib/admin-pin-config';

export function ChangePinForm({ hasPin }: { hasPin: boolean }) {
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [repeat, setRepeat] = useState('');
    const [status, setStatus] = useState('');
    const [pending, setPending] = useState(false);

    const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, PIN_LENGTH);

    const handleSubmit = async () => {
        if (!PIN_REGEX.test(next)) {
            setStatus(`❌ El PIN nuevo tiene que ser de ${PIN_LENGTH} dígitos.`);
            return;
        }
        if (next !== repeat) {
            setStatus('❌ Los dos PIN nuevos no coinciden.');
            return;
        }

        setPending(true);
        const res = await changePin(current, next);
        setPending(false);

        if (res?.success) {
            setStatus('✅ PIN guardado. Úsalo la próxima vez que entres.');
            setCurrent('');
            setNext('');
            setRepeat('');
        } else {
            setStatus(`❌ ${res?.error ?? 'No se pudo guardar el PIN'}`);
        }
    };

    return (
        <div className="bg-card rounded-lg border shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                <KeyRound className="w-5 h-5" /> {hasPin ? 'Cambiar PIN' : 'Poner un PIN'}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
                Es el PIN que se pide al entrar desde un móvil nuevo (5 toques en el título de la portada).
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                    <Label htmlFor="pin-current">
                        {hasPin ? 'PIN actual' : 'Contraseña actual'}
                    </Label>
                    <Input
                        id="pin-current"
                        type="password"
                        autoComplete="current-password"
                        inputMode={hasPin ? 'numeric' : 'text'}
                        value={current}
                        onChange={(e) => setCurrent(hasPin ? onlyDigits(e.target.value) : e.target.value)}
                    />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="pin-next">PIN nuevo</Label>
                    <Input
                        id="pin-next"
                        type="password"
                        autoComplete="new-password"
                        inputMode="numeric"
                        value={next}
                        onChange={(e) => setNext(onlyDigits(e.target.value))}
                    />
                </div>
                <div className="grid gap-1.5">
                    <Label htmlFor="pin-repeat">Repetir PIN nuevo</Label>
                    <Input
                        id="pin-repeat"
                        type="password"
                        autoComplete="new-password"
                        inputMode="numeric"
                        value={repeat}
                        onChange={(e) => setRepeat(onlyDigits(e.target.value))}
                    />
                </div>
            </div>

            <div className="flex items-center gap-4 mt-4">
                <Button onClick={handleSubmit} disabled={pending || !current || !next || !repeat}>
                    {pending ? 'Guardando...' : 'Guardar PIN'}
                </Button>
                {status && <span className="text-sm font-medium">{status}</span>}
            </div>
        </div>
    );
}
