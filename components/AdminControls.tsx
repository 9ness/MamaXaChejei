'use client';

import { useState } from 'react';
import { bulkAddMembers, deleteAllMembers } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
} from "@/components/ui/alert-dialog";
import { Trash2 } from 'lucide-react';

/**
 * Pegar la lista entera de golpe. Ojo: cada línea CREA un registro nuevo, así
 * que repegar la lista para meter a uno más duplica a todo el mundo — para eso
 * está `AddMemberForm`.
 */
export function BulkUpload() {
    const [bulkText, setBulkText] = useState('');
    const [bulkStatus, setBulkStatus] = useState('');

    const handleBulkUpload = async () => {
        if (!bulkText.trim()) return;
        setBulkStatus('Procesando...');
        const res = await bulkAddMembers(bulkText);
        if (res.success) {
            setBulkStatus(`✅ Éxito: ${res.count} registros creados.`);
            setBulkText('');
        } else {
            setBulkStatus(`❌ Error: ${res.error}`);
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid w-full gap-1.5">
                <Label htmlFor="bulk-text">Formato por línea: Número. Nombre Apellido1 Apellido2 Talla</Label>
                <Textarea
                    id="bulk-text"
                    placeholder={`1. Juan Pérez López L
2.Maria García M`}
                    rows={5}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                    Cada persona en una línea nueva. Añade, no reemplaza: si pegas a alguien
                    que ya está, sale dos veces.
                </p>
            </div>
            <div className="flex items-center gap-4">
                <Button onClick={handleBulkUpload} disabled={!bulkText.trim()}>
                    Procesar Lista
                </Button>
                {bulkStatus && <span className="text-sm font-medium">{bulkStatus}</span>}
            </div>
        </div>
    );
}

/** Vaciar la lista entera. Abajo del todo y en rojo, a propósito. */
export function DangerZone() {
    const handleDeleteAll = async () => {
        await deleteAllMembers();
    };

    return (
        <div className="bg-red-50 border border-red-100 rounded-lg p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-red-900 flex items-center gap-2">
                    <Trash2 className="w-4 h-4" /> Zona de Peligro
                </h3>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                            Vaciar Lista Completa
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción no se puede deshacer. Borrará permanentemente todos los
                                miembros y sus estados de la base de datos (prefijo &apos;fiesta:&apos;).
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteAll} className="bg-red-600 hover:bg-red-700">
                                Sí, borrar todo
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}
