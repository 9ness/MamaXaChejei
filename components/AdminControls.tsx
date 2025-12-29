'use client';

import { useState, useRef } from 'react';
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
import { Trash2, Upload } from 'lucide-react';

export function AdminControls() {
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

    const handleDeleteAll = async () => {
        await deleteAllMembers();
    };

    return (
        <div className="space-y-8 mt-8 border-t pt-8">
            {/* Bulk Load Section */}
            <div className="bg-card rounded-lg border shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Upload className="w-5 h-5" /> Carga Rápida
                </h3>
                <div className="space-y-4">
                    <div className="grid w-full gap-1.5">
                        <Label htmlFor="bulk-text">Pegar lista (Formato por línea: Nombre Apellido1 Apellido2 Talla)</Label>
                        <Textarea
                            id="bulk-text"
                            placeholder={`Juan Pérez López L
Maria García Ruiz M`}
                            rows={5}
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Cada persona en una línea nueva.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button onClick={handleBulkUpload} disabled={!bulkText.trim()}>
                            Procesar Lista
                        </Button>
                        {bulkStatus && <span className="text-sm font-medium">{bulkStatus}</span>}
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50 border border-red-100 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-red-900 mb-4 flex items-center gap-2">
                    <Trash2 className="w-5 h-5" /> Zona de Peligro
                </h3>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                            Vaciar Lista Completa
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción no se puede deshacer. Borrará permanentemente todos los miembros y sus estados de la base de datos (prefijo 'fiesta:').
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
