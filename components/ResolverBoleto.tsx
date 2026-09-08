'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { resolverBoleto } from '@/app/actions';

/** Botones de admin para cerrar un boleto. Es irreversible: al marcarlo ganado
 *  se pagan las moedas, y no hay marcha atrás. De ahí la confirmación. */
export function ResolverBoleto({ boletoId }: { boletoId: string }) {
    const router = useRouter();
    const [error, setError] = useState('');

    const resolver = async (resultado: 'ganado' | 'perdido') => {
        const res = await resolverBoleto(boletoId, resultado);
        if (res?.error) {
            setError(res.error);
            return;
        }
        router.refresh();
    };

    const boton = (resultado: 'ganado' | 'perdido', label: string, className: string) => (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className={className}>{label}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Pechar o boleto como {label.toLowerCase()}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {resultado === 'ganado'
                            ? 'Págaselles a todos os que apostaron e non se pode desfacer.'
                            : 'Os que apostaron perden as súas moedas e non se pode desfacer.'}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => resolver(resultado)}>Si, pechar</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    return (
        <div className="mt-4 rounded-lg border border-dashed p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                🛡️ Resolver (só admin)
            </p>
            <div className="flex gap-2">
                {boton('ganado', 'Gañado', 'border-green-500 text-green-700 hover:bg-green-50')}
                {boton('perdido', 'Perdido', 'border-red-500 text-red-700 hover:bg-red-50')}
            </div>
            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>
    );
}
