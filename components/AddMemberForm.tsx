'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { addMember } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TALLAS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

/**
 * Alta de una persona suelta. La Carga Rápida es para pegar la lista entera:
 * volver a pegarla para meter a uno más duplicaba a todos, porque cada línea
 * crea un registro nuevo.
 */
export function AddMemberForm() {
    const router = useRouter();
    const [nombre, setNombre] = useState('');
    const [talla, setTalla] = useState('L');
    const [otra, setOtra] = useState('');
    const [estado, setEstado] = useState('');
    const [pending, setPending] = useState(false);

    const tallaFinal = talla === 'otra' ? otra : talla;
    const listo = nombre.trim().length >= 2 && tallaFinal.trim().length > 0;

    const guardar = async () => {
        if (!listo) return;
        setPending(true);
        setEstado('');
        const res = await addMember(nombre, tallaFinal);
        setPending(false);

        if (res.error) {
            setEstado(`❌ ${res.error}`);
            return;
        }
        setEstado(`✅ ${res.nombre} añadido con el número ${res.orden}.`);
        setNombre('');
        setOtra('');
        router.refresh();
    };

    return (
        <div className="bg-card rounded-lg border shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5" /> Añadir persona
            </h3>

            <div className="space-y-4">
                <div className="grid w-full gap-1.5">
                    <Label htmlFor="add-nombre">Nombre y apellidos</Label>
                    <Input
                        id="add-nombre"
                        value={nombre}
                        maxLength={60}
                        placeholder="Juan Pérez López"
                        onChange={(e) => setNombre(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }}
                    />
                </div>

                <div className="grid w-full gap-1.5">
                    <Label>Talla</Label>
                    <div className="flex flex-wrap gap-2">
                        {TALLAS.map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTalla(t)}
                                className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${
                                    talla === t
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'hover:bg-muted'
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                        {/* Las de los críos van por edad ("5 AÑOS"), no por letra. */}
                        <button
                            type="button"
                            onClick={() => setTalla('otra')}
                            className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${
                                talla === 'otra'
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'hover:bg-muted'
                            }`}
                        >
                            Otra
                        </button>
                    </div>

                    {talla === 'otra' && (
                        <Input
                            value={otra}
                            maxLength={12}
                            placeholder="5 años"
                            aria-label="Otra talla"
                            className="mt-2"
                            onChange={(e) => setOtra(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }}
                        />
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <Button onClick={guardar} disabled={!listo || pending}>
                        {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Añadir
                    </Button>
                    {estado && <span className="text-sm font-medium">{estado}</span>}
                </div>

                <p className="text-xs text-muted-foreground">
                    Se coloca al final de la lista, con el número siguiente. No toca a nadie más.
                </p>
            </div>
        </div>
    );
}
