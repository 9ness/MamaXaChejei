'use client';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Member } from '@/app/actions';
import { cn } from '@/lib/utils';

interface MemberCardProps {
    member: Member;
    isAdmin: boolean;
    onToggle: (id: string, field: 'pagado' | 'recogido', val: boolean) => void;
}

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from 'react';

// ... (imports remain)

export function MemberCard({ member, isAdmin, onToggle }: MemberCardProps) {
    const [alertOpen, setAlertOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ field: 'pagado' | 'recogido', val: boolean } | null>(null);

    const checkAndToggle = (field: 'pagado' | 'recogido', currentValue: boolean) => {
        if (!isAdmin) return;

        // If unchecking (true -> false), warning
        if (currentValue === true) {
            setPendingAction({ field, val: currentValue });
            setAlertOpen(true);
        } else {
            onToggle(member.id, field, currentValue);
        }
    };

    const confirmAction = () => {
        if (pendingAction) {
            onToggle(member.id, pendingAction.field, pendingAction.val);
            setPendingAction(null);
        }
    };

    return (
        <>
            <Card className="w-full mb-4 shadow-sm border-l-4 border-l-primary/50 overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-secondary/10">
                    <CardTitle className="text-lg font-bold truncate">
                        {member.nombre} <span className="text-muted-foreground font-normal">{member.apellido1} {member.apellido2}</span>
                    </CardTitle>
                    <Badge variant={member.recogido ? "default" : "secondary"}>
                        {member.recogido ? "Recogido" : "Pendiente"}
                    </Badge>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Talla</span>
                        <span className="font-bold text-xl text-primary">{member.talla}</span>
                    </div>

                    {/* Status Rows */}
                    <div className="space-y-3 mt-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className={cn("w-3 h-3 rounded-full shadow-sm", member.pagado ? "bg-green-500" : "bg-red-300")} />
                                <span className="font-semibold">Pago</span>
                            </div>
                            {isAdmin ? (
                                <div className="flex flex-col items-end gap-1">
                                    <Button
                                        size="default"
                                        variant={member.pagado ? "default" : "secondary"}
                                        className={cn(
                                            "h-10 px-6 font-bold transition-all duration-200 shadow-sm",
                                            member.pagado
                                                ? "bg-green-600 hover:bg-green-700 text-white"
                                                : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                                        )}
                                        onClick={() => checkAndToggle('pagado', member.pagado)}
                                    >
                                        {member.pagado ? "PAGADO" : "PENDIENTE"}
                                    </Button>
                                    {member.pagado && member.fechaPagado && (
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                            {new Date(member.fechaPagado).toLocaleDateString('es-ES')} {new Date(member.fechaPagado).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <span className="text-sm font-bold px-3 py-1 rounded bg-white/50 border">
                                    {member.pagado ? "✅ PAGADO" : "❌ PENDIENTE"}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className={cn("w-3 h-3 rounded-full shadow-sm", member.recogido ? "bg-purple-500" : "bg-yellow-300")} />
                                <span className="font-semibold">Recogida</span>
                            </div>
                            {isAdmin ? (
                                <div className="flex flex-col items-end gap-1">
                                    <Button
                                        size="default"
                                        variant={member.recogido ? "default" : "secondary"}
                                        className={cn(
                                            "h-10 px-6 font-bold transition-all duration-200 shadow-sm",
                                            member.recogido
                                                ? "bg-purple-600 hover:bg-purple-700 text-white"
                                                : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                                        )}
                                        onClick={() => checkAndToggle('recogido', member.recogido)}
                                    >
                                        {member.recogido ? "RECOGIDO" : "PENDIENTE"}
                                    </Button>
                                    {member.recogido && member.fechaRecogido && (
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                            {new Date(member.fechaRecogido).toLocaleDateString('es-ES')} {new Date(member.fechaRecogido).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <span className="text-sm font-bold px-3 py-1 rounded bg-white/50 border">
                                    {member.recogido ? "✅ RECOGIDO" : "❌ PENDIENTE"}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Date footer moved to CardFooter */}

                </CardContent>
                {(!isAdmin && (member.fechaPagado || member.fechaRecogido)) && (
                    <CardFooter className="pt-0 pb-4 text-[10px] text-muted-foreground grid grid-cols-2 gap-2">
                        {member.fechaPagado && (
                            <div>
                                <span className="font-semibold block text-green-700">Pago:</span>
                                {new Date(member.fechaPagado).toLocaleDateString('es-ES')} {new Date(member.fechaPagado).toLocaleTimeString('es-ES')}
                            </div>
                        )}
                        {member.fechaRecogido && (
                            <div className="text-right justify-self-end">
                                <span className="font-semibold block text-purple-700">Recogida:</span>
                                {new Date(member.fechaRecogido).toLocaleDateString('es-ES')} {new Date(member.fechaRecogido).toLocaleTimeString('es-ES')}
                            </div>
                        )}
                    </CardFooter>
                )}
            </Card>

            <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro de desmarcar?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Si desmarcas esta casilla, se perderá el registro de la fecha y hora original.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPendingAction(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmAction}>Confirmar cambio</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
