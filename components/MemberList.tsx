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
import { LayoutGrid, TableProperties, Filter, Hash, ChevronDown, ChevronUp, Shirt } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function MemberList({ initialMembers, isAdmin = false }: MemberListProps) {
    const [query, setQuery] = useState('');
    const [orderQuery, setOrderQuery] = useState('');
    const [mobileView, setMobileView] = useState<'cards' | 'table'>('table');
    const [quickFilter, setQuickFilter] = useState<'all' | 'pendingPayment' | 'pendingPickup'>('all');
    const [sizeDashboardOpen, setSizeDashboardOpen] = useState(false);
    const [sizeFilter, setSizeFilter] = useState<{ talla: string, mode: 'all' | 'recogidos' | 'pendientes' } | null>(null);

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

        const matchesName = name.includes(q) || ap1.includes(q) || ap2.includes(q) || (name + ' ' + ap1 + ' ' + ap2).includes(q);

        const qNum = orderQuery.trim();
        const matchesOrder = qNum === '' || (m.order !== undefined && m.order.toString() === qNum);

        const matchesSearch = matchesName && matchesOrder;

        if (!matchesSearch) return false;

        // Quick Filters
        if (sizeFilter) {
            // Override quick filters if size filter is active
            // Harden comparison: normalize to string and trim to avoid mismatch
            const mTalla = String(m.talla || '').trim();
            const fTalla = String(sizeFilter.talla || '').trim();

            if (mTalla !== fTalla) return false;
            if (sizeFilter.mode === 'recogidos' && !m.recogido) return false;
            if (sizeFilter.mode === 'pendientes' && m.recogido) return false;
        } else {
            if (quickFilter === 'pendingPayment') {
                return !m.pagado;
            }
            if (quickFilter === 'pendingPickup') {
                return !m.recogido;
            }
        }

        return true;
    });

    // Calculate Size Stats
    const sizeStats = optimisticMembers.reduce((acc, member) => {
        const t = member.talla || 'SIN TALLA';
        if (!acc[t]) acc[t] = { total: 0, recogidos: 0, pendientes: 0 };
        acc[t].total++;
        if (member.recogido) acc[t].recogidos++;
        else acc[t].pendientes++;
        return acc;
    }, {} as Record<string, { total: number, recogidos: number, pendientes: number }>);

    const sortedSizes = Object.keys(sizeStats).sort((a, b) => {
        // Custom sort order preference: Numbers/Years first, then Standard sizes
        const standardOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL'];
        const idxA = standardOrder.indexOf(a);
        const idxB = standardOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return 1; // Standard sizes after numeric/other? Or before? User example S, M... maybe before.
        if (idxB !== -1) return -1;
        return a.localeCompare(b, undefined, { numeric: true });
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
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border">
                <div className="flex gap-2 w-full md:w-96">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Buscar por nombre..."
                            className="pl-8"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    <div className="relative w-24">
                        <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Nº"
                            className="pl-8"
                            value={orderQuery}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, ''); // Only numbers
                                setOrderQuery(val);
                            }}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-5 sm:gap-7 w-full md:w-auto justify-around md:justify-end">
                    <div className="flex flex-col items-center md:items-end">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
                        <span className="text-foreground font-bold text-2xl tabular-nums leading-none mt-0.5">{total}</span>
                    </div>
                    <div className="h-9 w-px bg-border" />
                    <div className="flex flex-col items-center md:items-end">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pagados</span>
                        <span className="text-emerald-600 font-bold text-2xl tabular-nums leading-none mt-0.5">{paid}</span>
                    </div>
                    <div className="h-9 w-px bg-border" />
                    <div className="flex flex-col items-center md:items-end">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Recollidos</span>
                        <span className="text-blue-600 font-bold text-2xl tabular-nums leading-none mt-0.5">{picked}</span>
                    </div>
                </div>
            </div>

            {/* Size Distribution Dashboard (Admin Only) */}
            {isAdmin && (
                <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                    <button
                        onClick={() => setSizeDashboardOpen(!sizeDashboardOpen)}
                        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                        <div className="flex flex-col items-start gap-1 font-semibold text-slate-700">
                            <div className="flex items-center gap-2">
                                <Shirt className="w-5 h-5 text-indigo-500" />
                                <span>Distribución de Tallas</span>
                            </div>
                            {sizeFilter && <Badge variant="secondary" className="ml-7 text-[10px] break-all">Filtro: {sizeFilter.talla} ({sizeFilter.mode})</Badge>}
                        </div>
                        {sizeDashboardOpen ? <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />}
                    </button>

                    {sizeDashboardOpen && (
                        <div className="p-4 border-t bg-slate-50/50">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {sortedSizes.map(talla => {
                                    const stat = sizeStats[talla];
                                    const isActive = sizeFilter?.talla === talla;
                                    return (
                                        <div key={talla} className={`flex flex-col gap-2 p-3 rounded-md border ${isActive ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                                            <div className="font-bold text-sm text-slate-800 flex justify-between items-center">
                                                <span>Talla {talla}</span>
                                                {isActive && <button onClick={() => { setSizeFilter(null); setQuickFilter("all"); }} className="text-[10px] text-red-500 hover:underline">Limpiar</button>}
                                            </div>
                                            <div className="flex gap-2 text-[10px] sm:text-xs">
                                                <button
                                                    onClick={() => { setSizeFilter({ talla, mode: 'all' }); setQuickFilter('all'); }}
                                                    className={`flex-1 px-1 py-1 rounded border text-center transition-colors truncate ${sizeFilter?.talla === talla && sizeFilter.mode === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                                >
                                                    Total ({stat.total})
                                                </button>
                                                <button
                                                    onClick={() => { setSizeFilter({ talla, mode: 'recogidos' }); setQuickFilter('all'); }}
                                                    className={`flex-1 px-1 py-1 rounded border text-center transition-colors truncate ${sizeFilter?.talla === talla && sizeFilter.mode === 'recogidos' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                                                >
                                                    Recog. ({stat.recogidos})
                                                </button>
                                                <button
                                                    onClick={() => { setSizeFilter({ talla, mode: 'pendientes' }); setQuickFilter('all'); }}
                                                    className={`flex-1 px-1 py-1 rounded border text-center transition-colors truncate ${sizeFilter?.talla === talla && sizeFilter.mode === 'pendientes' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}
                                                >
                                                    Faltan ({stat.pendientes})
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Global Quick Filters */}
            <div className="flex flex-col md:flex-row md:items-center gap-2">
                <span className="text-xs font-medium mr-1 hidden md:flex items-center gap-1 text-muted-foreground whitespace-nowrap"><Filter className="w-3.5 h-3.5" /> Filtros</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
                    <button
                        onClick={() => setQuickFilter('all')}
                        className={`w-full text-sm font-medium rounded-lg border px-3 py-2 transition-colors ${quickFilter === 'all' ? "bg-foreground text-background border-transparent" : "bg-background text-muted-foreground border-border hover:bg-muted"}`}
                    >
                        Todos <span className="tabular-nums opacity-70">({total})</span>
                    </button>
                    <button
                        onClick={() => setQuickFilter('pendingPayment')}
                        className={`w-full text-sm font-medium rounded-lg border px-3 py-2 transition-colors ${quickFilter === 'pendingPayment' ? "bg-rose-600 text-white border-transparent" : "bg-background text-rose-600 border-rose-200 hover:bg-rose-50"}`}
                    >
                        Pendentes de pago <span className="tabular-nums opacity-80">({total - paid})</span>
                    </button>
                    <button
                        onClick={() => setQuickFilter('pendingPickup')}
                        className={`w-full text-sm font-medium rounded-lg border px-3 py-2 transition-colors ${quickFilter === 'pendingPickup' ? "bg-amber-600 text-white border-transparent" : "bg-background text-amber-600 border-amber-200 hover:bg-amber-50"}`}
                    >
                        Pendentes de recollida <span className="tabular-nums opacity-80">({total - picked})</span>
                    </button>
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
