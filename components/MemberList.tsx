'use client';

import { useOptimistic, useState } from 'react';
import { Input } from "@/components/ui/input";
import { MemberCard } from './MemberCard';
import { MemberTable } from './MemberTable';
import type { Member } from '@/app/actions';
import { toggleStatus } from '@/app/actions';
import { Search } from 'lucide-react';

interface MemberListProps {
    initialMembers: Member[];
    isAdmin?: boolean;
}

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, TableProperties, Filter } from 'lucide-react';
import { Button } from "@/components/ui/button";

export function MemberList({ initialMembers, isAdmin = false }: MemberListProps) {
    const [query, setQuery] = useState('');
    const [mobileView, setMobileView] = useState<'cards' | 'table'>('table');
    const [quickFilter, setQuickFilter] = useState<'all' | 'pendingPayment' | 'pendingPickup'>('all');

    // Optimistic State
    const [optimisticMembers, setOptimisticMembers] = useOptimistic(
        initialMembers,
        (state, updatedMember: { id: string; field: 'pagado' | 'recogido'; value: boolean }) => {
            return state.map((member) => {
                if (member.id === updatedMember.id) {
                    const now = new Date().toISOString();
                    return {
                        ...member,
                        [updatedMember.field]: updatedMember.value,
                        [updatedMember.field === 'pagado' ? 'fechaPagado' : 'fechaRecogido']: updatedMember.value ? now : ''
                    };
                }
                return member;
            });
        }
    );

    const handleToggle = async (id: string, field: 'pagado' | 'recogido', val: boolean) => {
        // Optimistic update
        setOptimisticMembers({ id, field, value: !val }); // We pass the !val because we are toggling

        try {
            await toggleStatus(id, field, val);
        } catch (error) {
            console.error("Failed to update status", error);
            // Revert is automatic if we rely on server revalidation properties of Next.js, 
            // but strict optimistic revert requires more complex state or React Query.
            // For this MVP, we assume success or refresh.
            alert("Error al actualizar. Por favor recarga.");
        }
    };

    const normalizedQuery = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    const filteredMembers = optimisticMembers.filter(m => {
        // Text Search
        const q = normalizedQuery(query);
        const name = normalizedQuery(m.nombre);
        const ap1 = normalizedQuery(m.apellido1);
        const ap2 = m.apellido2 ? normalizedQuery(m.apellido2) : '';
        const matchesSearch = name.includes(q) || ap1.includes(q) || ap2.includes(q) || (name + ' ' + ap1 + ' ' + ap2).includes(q);

        if (!matchesSearch) return false;

        // Quick Filters
        if (quickFilter === 'pendingPayment') {
            return !m.pagado;
        }
        if (quickFilter === 'pendingPickup') {
            return !m.recogido;
        }

        return true;
    });

    // Calculate totals (based on TOTAL list, not filtered, or maybe filtered? 
    // Usually totals at top correspond to the full dataset context, but filtered makes sense if searching.
    // However, the requested UI has those counts as "global stats". 
    // Let's keep them based on the search query but maybe ignore the quick filter for the "Total" stats?
    // Actually, "Pagados" count in the header probably refers to global state.
    // Let's calculate stats from optimisticMembers (Global) to keep them useful as a dashboard.
    const total = optimisticMembers.length;
    const paid = optimisticMembers.filter(m => m.pagado).length;
    const picked = optimisticMembers.filter(m => m.recogido).length;

    return (
        <div className="space-y-6">
            {/* Search and Stats */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Buscar por nombre..."
                        className="pl-8"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-6 text-sm font-medium text-muted-foreground w-full md:w-auto justify-around md:justify-end">
                    <div className="flex flex-col items-center md:items-end p-2 bg-blue-50 rounded-lg min-w-[80px]">
                        <span className="text-[10px] uppercase tracking-wider text-blue-800">Total</span>
                        <span className="text-blue-700 font-black text-2xl">{total}</span>
                    </div>
                    <div className="flex flex-col items-center md:items-end p-2 bg-green-50 rounded-lg min-w-[80px]">
                        <span className="text-[10px] uppercase tracking-wider text-green-800">Pagados</span>
                        <span className="text-green-600 font-black text-2xl">{paid}</span>
                    </div>
                    <div className="flex flex-col items-center md:items-end p-2 bg-purple-50 rounded-lg min-w-[80px]">
                        <span className="text-[10px] uppercase tracking-wider text-purple-800">Recogidos</span>
                        <span className="text-purple-600 font-black text-2xl">{picked}</span>
                    </div>
                </div>
            </div>

            {/* Global Quick Filters */}
            <div className="flex flex-col md:flex-row gap-2">
                <span className="text-sm font-medium mr-2 hidden md:flex items-center gap-1 text-muted-foreground whitespace-nowrap"><Filter className="w-4 h-4 ml-2" /> Filtros:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
                    <Button
                        variant={quickFilter === 'all' ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setQuickFilter('all')}
                        className="w-full"
                    >
                        Todos ({total})
                    </Button>
                    <Button
                        variant={quickFilter === 'pendingPayment' ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setQuickFilter('pendingPayment')}
                        className={`w-full ${quickFilter === 'pendingPayment' ? "text-red-700 bg-red-100 ring-1 ring-red-200" : "text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"}`}
                    >
                        Pendientes de Pago ({total - paid})
                    </Button>
                    <Button
                        variant={quickFilter === 'pendingPickup' ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setQuickFilter('pendingPickup')}
                        className={`w-full ${quickFilter === 'pendingPickup' ? "text-orange-700 bg-orange-100 ring-1 ring-orange-200" : "text-orange-600 hover:bg-orange-50 hover:text-orange-700 border-orange-200"}`}
                    >
                        Pendientes de Recogida ({total - picked})
                    </Button>
                </div>
            </div>

            {/* Mobile View Toggle */}
            <div className="md:hidden flex justify-center">
                <Tabs value={mobileView} onValueChange={(v) => setMobileView(v as 'cards' | 'table')} className="w-full max-w-[400px]">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="cards" className="flex items-center gap-2">
                            <LayoutGrid className="w-4 h-4" /> Tarjetas
                        </TabsTrigger>
                        <TabsTrigger value="table" className="flex items-center gap-2">
                            <TableProperties className="w-4 h-4" /> Tabla
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Mobile View Content */}
            <div className="block md:hidden">
                {mobileView === 'cards' ? (
                    <div className="space-y-4">
                        {filteredMembers.map(member => (
                            <MemberCard
                                key={member.id}
                                member={member}
                                isAdmin={isAdmin}
                                onToggle={handleToggle}
                            />
                        ))}
                        {filteredMembers.length === 0 && <div className="text-center p-8 text-muted-foreground">No se encontraron miembros.</div>}
                    </div>
                ) : (
                    <MemberTable
                        members={filteredMembers}
                        isAdmin={isAdmin}
                        onToggle={handleToggle}
                        isMobile={true}
                    />
                )}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block">
                <MemberTable
                    members={filteredMembers}
                    isAdmin={isAdmin}
                    onToggle={handleToggle}
                />
            </div>
        </div>
    );
}
