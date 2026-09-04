'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { AdminPinFlow } from '@/components/AdminPinFlow';
import { disableAdminMode, enableAdminMode, isPinConfigured } from '@/app/admin/actions';

const TAPS_NEEDED = 5;
const TAP_WINDOW_MS = 3000;
const TOAST_MS = 2200;

interface SecretAdminGateProps {
    children: React.ReactNode;
    isAdmin?: boolean;
    /** Este móvil ya marcó el PIN alguna vez: el gesto pasa a ser un interruptor. */
    trusted?: boolean;
}

/**
 * Puerta secreta al modo admin: 5 toques seguidos (menos de 3 s entre ellos)
 * sobre lo que envuelva este componente. La primera vez pide crear el PIN;
 * después el móvil queda recordado y el gesto solo enciende y apaga el modo
 * admin. No hay ningún indicio visual — para la peña esto es solo el título.
 */
export function SecretAdminGate({ children, isAdmin = false, trusted = false }: SecretAdminGateProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [hasPin, setHasPin] = useState(true);
    const [toast, setToast] = useState('');

    const taps = useRef(0);
    const lastTap = useRef(0);
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const busy = useRef(false);

    const showToast = (message: string) => {
        setToast(message);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(''), TOAST_MS);
    };

    const trigger = async () => {
        if (isAdmin) {
            await disableAdminMode();
            showToast('Modo normal');
            router.refresh();
            return;
        }

        if (trusted) {
            const res = await enableAdminMode();
            if (res?.success) {
                showToast('Modo admin activado');
                router.refresh();
                return;
            }
            // Dispositivo caducado o secreto rotado: se cae al teclado del PIN.
        }

        setHasPin(await isPinConfigured());
        setOpen(true);
    };

    const handleTap = () => {
        const now = Date.now();
        taps.current = now - lastTap.current > TAP_WINDOW_MS ? 1 : taps.current + 1;
        lastTap.current = now;

        if (taps.current < TAPS_NEEDED || busy.current) return;
        taps.current = 0;
        busy.current = true;
        trigger().finally(() => { busy.current = false; });
    };

    return (
        <>
            <span onClick={handleTap} className="select-none cursor-default">
                {children}
            </span>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-xs">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-center gap-2 text-base">
                            <ShieldCheck className="w-4 h-4" />
                            {hasPin ? 'Modo gestión' : 'Crear PIN de gestión'}
                        </DialogTitle>
                    </DialogHeader>

                    <AdminPinFlow
                        hasPin={hasPin}
                        onDone={() => {
                            setOpen(false);
                            router.push('/gestion');
                            router.refresh();
                        }}
                    />
                </DialogContent>
            </Dialog>

            {toast && (
                <div className="fixed inset-x-0 bottom-24 md:bottom-8 z-50 flex justify-center px-4 pointer-events-none">
                    <span className="rounded-full bg-foreground/90 text-background text-sm font-medium px-4 py-2 shadow-lg">
                        {toast}
                    </span>
                </div>
            )}
        </>
    );
}
