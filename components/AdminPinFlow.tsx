'use client';

import { useState } from 'react';
import { PinPad } from '@/components/PinPad';
import { loginWithPin, setupPin } from '@/app/admin/actions';
import { PIN_LENGTH } from '@/lib/admin-pin-config';

type Step = 'login' | 'choose' | 'repeat';

interface AdminPinFlowProps {
    /** false → primera vez: en vez de pedir el PIN, se elige y se guarda en Redis. */
    hasPin: boolean;
    onDone: () => void;
}

/**
 * Teclado + flujo del PIN, compartido por la puerta secreta del título y por la
 * pantalla de login de /gestion. Al acertar (o al crearlo) el servidor deja el
 * móvil marcado como de confianza, así que la próxima vez basta el gesto.
 */
export function AdminPinFlow({ hasPin, onDone }: AdminPinFlowProps) {
    const [step, setStep] = useState<Step>(hasPin ? 'login' : 'choose');
    const [pin, setPin] = useState('');
    const [first, setFirst] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);

    const fail = (message: string) => {
        setError(message);
        setPin('');
    };

    const submit = async (value: string, action: typeof loginWithPin) => {
        setPending(true);
        const res = await action(value);
        setPending(false);

        if (res?.success) {
            onDone();
            return;
        }
        if (step === 'repeat') {
            setFirst('');
            setStep('choose');
        }
        fail(res?.error ?? 'PIN incorrecto');
    };

    // Todo sale del propio teclado, no de un efecto: en cuanto se marca el
    // último dígito se avanza de paso.
    const handleChange = (value: string) => {
        setError('');
        setPin(value);
        if (value.length !== PIN_LENGTH) return;

        if (step === 'login') {
            submit(value, loginWithPin);
        } else if (step === 'choose') {
            setFirst(value);
            setPin('');
            setStep('repeat');
        } else if (value !== first) {
            setFirst('');
            setStep('choose');
            fail('Non coinciden. Próbao outra vez.');
        } else {
            submit(value, setupPin);
        }
    };

    const hint =
        step === 'login' ? 'Marca o teu PIN'
            : step === 'choose' ? 'Elixe un PIN de 4 díxitos'
                : 'Repite o PIN';

    return (
        <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">{hint}</p>
            <PinPad
                value={pin}
                onChange={handleChange}
                length={PIN_LENGTH}
                disabled={pending}
                shake={Boolean(error)}
            />
            <p className="h-5 text-center text-sm font-medium text-red-500">{error}</p>
        </div>
    );
}
