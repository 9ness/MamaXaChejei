import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    useReactTable,
    SortingState,
    ColumnFiltersState,
    VisibilityState,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import type { Member } from '@/app/actions';
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter } from "lucide-react";
import { usePathname } from 'next/navigation';

interface MemberTableProps {
    members: Member[];
    isAdmin: boolean;
    onToggle: (id: string, field: 'pagado' | 'recogido', val: boolean) => void;
    isMobile?: boolean;
}

export function MemberTable({ members, isAdmin, onToggle, isMobile = false }: MemberTableProps) {
    const [sorting, setSorting] = useState<SortingState>([{ id: 'order', desc: false }]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ order: false });
    const [alertOpen, setAlertOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ id: string, field: 'pagado' | 'recogido', val: boolean } | null>(null);

    // Determine visibility based on route
    const pathname = usePathname();
    const isPublicView = pathname === '/';
    // Logic: Admin route (/admin) shows ALL columns. Public route (/) hides dates.
    // User request: "Si la ruta ES /admin... mostrar todas. Si NO ES... ocultar fechas".
    const showDates = pathname.startsWith('/admin');

    const handleCheckChange = (id: string, field: 'pagado' | 'recogido', currentValue: boolean) => {
        if (currentValue === true) {
            setPendingAction({ id, field, val: currentValue });
            setAlertOpen(true);
        } else {
            onToggle(id, field, currentValue);
        }
    };

    const confirmAction = () => {
        if (pendingAction) {
            onToggle(pendingAction.id, pendingAction.field, pendingAction.val);
            setPendingAction(null);
        }
    };

    const allDesktopColumns: ColumnDef<Member>[] = [
        {
            accessorKey: "nombre",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="px-0 font-bold hover:bg-transparent text-[13px]"
                    >
                        Nombre
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                );
            },
            cell: ({ row }) => <span className="font-medium text-[13px]">{row.getValue("nombre")} <span className="text-muted-foreground font-normal text-[11px]">({row.original.order})</span></span>,
        },
        {
            accessorKey: "apellido1",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="px-0 font-bold hover:bg-transparent text-[13px]">
                    1º Apellido <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
            ),
            cell: ({ row }) => <span className="text-[13px]">{row.getValue("apellido1")}</span>,
        },
        {
            accessorKey: "apellido2",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="px-0 font-bold hover:bg-transparent text-[13px]">
                    2º Apellido <ArrowUpDown className="ml-2 h-3 w-3" />
                </Button>
            ),
            cell: ({ row }) => <span className="text-[13px]">{row.getValue("apellido2")}</span>,
        },
        {
            accessorKey: "talla",
            header: ({ column }) => (
                <div className="w-[60px] text-center">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="px-0 font-bold hover:bg-transparent text-[13px]">
                        Talla <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => <div className="w-[60px] text-center"><Badge variant="outline" className="font-mono text-[11px] px-1 h-5">{row.getValue("talla")}</Badge></div>,
        },
        {
            accessorKey: "pagado",
            header: ({ column }) => (
                <div className="text-center w-[90px]">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="px-0 font-bold hover:bg-transparent text-[13px]">
                        Pagado <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => {
                const member = row.original;
                const dateVal = member.fechaPagado;
                return (
                    <div className="flex flex-col items-center justify-center w-[90px]">
                        {isAdmin ? (
                            <>
                                <Checkbox
                                    checked={member.pagado}
                                    onCheckedChange={() => handleCheckChange(member.id, 'pagado', member.pagado)}
                                    className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 w-4 h-4"
                                />
                                {dateVal && (
                                    <div className="flex flex-col items-center mt-1">
                                        <span className="text-[10px] text-muted-foreground font-mono leading-none">
                                            {new Date(dateVal).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                        </span>
                                        <span className="text-[9px] text-muted-foreground/70 font-mono leading-none">
                                            {new Date(dateVal).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            member.pagado ? <span className="text-green-600 font-bold text-lg">✓</span> : <span className="text-muted-foreground">-</span>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: "fechaPagado",
            header: ({ column }) => (
                <div className="text-center">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="px-0 font-bold hover:bg-transparent text-[13px]">
                        F. Pago <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => {
                const val = row.getValue("fechaPagado") as string;
                return (
                    <div className="text-center text-[11px] text-muted-foreground font-mono">
                        {val ? (
                            <div className="flex flex-col">
                                <span>{new Date(val).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                                <span className="text-[10px] opacity-70">{new Date(val).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        ) : '-'}
                    </div>
                )
            }
        },
        {
            accessorKey: "recogido",
            header: ({ column }) => (
                <div className="text-center w-[90px]">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="px-0 font-bold hover:bg-transparent text-[13px]">
                        Recogido <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => {
                const member = row.original;
                const dateVal = member.fechaRecogido;
                return (
                    <div className="flex flex-col items-center justify-center w-[90px]">
                        {isAdmin ? (
                            <>
                                <Checkbox
                                    checked={member.recogido}
                                    onCheckedChange={() => handleCheckChange(member.id, 'recogido', member.recogido)}
                                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 w-4 h-4"
                                />
                                {dateVal && (
                                    <div className="flex flex-col items-center mt-1">
                                        <span className="text-[10px] text-muted-foreground font-mono leading-none">
                                            {new Date(dateVal).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                        </span>
                                        <span className="text-[9px] text-muted-foreground/70 font-mono leading-none">
                                            {new Date(dateVal).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            member.recogido ? <span className="text-blue-600 font-bold text-lg">✓</span> : <span className="text-muted-foreground">-</span>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: "fechaRecogido",
            header: ({ column }) => (
                <div className="text-center">
                    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="px-0 font-bold hover:bg-transparent text-[13px]">
                        F. Recogida <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                </div>
            ),
            cell: ({ row }) => {
                const val = row.getValue("fechaRecogido") as string;
                return (
                    <div className="text-center text-[11px] text-muted-foreground font-mono">
                        {val ? (
                            <div className="flex flex-col">
                                <span>{new Date(val).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                                <span className="text-[10px] opacity-70">{new Date(val).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        ) : '-'}
                    </div>
                )
            }
        },
        {
            accessorKey: "order",
            header: "Order",
        },
    ];

    const allMobileColumns: ColumnDef<Member>[] = [
        {
            accessorKey: "nombre",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="px-0 font-bold text-[10px] h-6 hover:bg-transparent text-left w-full justify-start pl-1">
                    Membro <ArrowUpDown className="ml-1 h-2 w-2" />
                </Button>
            ),
            cell: ({ row }) => (
                <div className="flex flex-col leading-tight max-w-[110px] overflow-hidden">
                    <span className="font-bold text-xs truncate text-slate-900">{row.original.nombre} <span className="font-normal opacity-70 text-[10px]">({row.original.order})</span></span>
                    <span className="text-[10px] text-slate-500 truncate -mt-0.5">{row.original.apellido1}</span>
                    {row.original.apellido2 && <span className="text-[10px] text-slate-500 truncate -mt-0.5">{row.original.apellido2}</span>}
                </div>
            ),
        },
        {
            accessorKey: "talla",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="px-0 font-bold text-[10px] h-6 hover:bg-transparent justify-center w-8">
                    T <ArrowUpDown className="ml-0.5 h-2 w-2" />
                </Button>
            ),
            cell: ({ row }) => <div className="text-center w-8"><span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 rounded px-1">{row.getValue("talla")}</span></div>,
        },
        {
            accessorKey: "pagado",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="px-0 font-bold text-[10px] h-6 hover:bg-transparent justify-center w-10">
                    € <ArrowUpDown className="ml-0.5 h-2 w-2" />
                </Button>
            ),
            cell: ({ row }) => {
                const member = row.original;
                const val = member.fechaPagado;
                return (
                    <div className="flex flex-col items-center justify-center w-10">
                        {isAdmin ? (
                            <Checkbox
                                checked={member.pagado}
                                onCheckedChange={() => handleCheckChange(member.id, 'pagado', member.pagado)}
                                className="w-4 h-4 border-slate-300 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 rounded-[3px]"
                            />
                        ) : (
                            member.pagado ? <div className="w-2 h-2 rounded-full bg-green-500" /> : <div className="w-2 h-2 rounded-full bg-slate-200" />
                        )}
                        {(showDates && val) && (
                            <div className="flex flex-col items-center mt-0.5">
                                <span className="text-[8px] text-black font-bold font-mono leading-none">{new Date(val).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>
                                <span className="text-[7px] text-slate-600 font-mono leading-none">{new Date(val).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: "recogido",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} className="px-0 font-bold text-[10px] h-6 hover:bg-transparent justify-center w-10">
                    📦 <ArrowUpDown className="ml-0.5 h-2 w-2" />
                </Button>
            ),
            cell: ({ row }) => {
                const member = row.original;
                const val = member.fechaRecogido;
                return (
                    <div className="flex flex-col items-center justify-center w-10">
                        {isAdmin ? (
                            <Checkbox
                                checked={member.recogido}
                                onCheckedChange={() => handleCheckChange(member.id, 'recogido', member.recogido)}
                                className="w-4 h-4 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 rounded-[3px]"
                            />
                        ) : (
                            member.recogido ? <div className="w-2 h-2 rounded-full bg-blue-500" /> : <div className="w-2 h-2 rounded-full bg-slate-200" />
                        )}
                        {(showDates && val) && (
                            <div className="flex flex-col items-center mt-0.5">
                                <span className="text-[8px] text-black font-bold font-mono leading-none">{new Date(val).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>
                                <span className="text-[7px] text-slate-600 font-mono leading-none">{new Date(val).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: "order",
            header: "Order",
        },
    ];

    // Select the set of columns based on mobile/desktop
    const rawColumns = isMobile ? allMobileColumns : allDesktopColumns;

    // Filter visibility strictly based on requirements
    const columns = useMemo(() => {
        return rawColumns.filter((col: any) => {
            // Obtenemos el identificador de la columna de forma segura
            const columnId = col.accessorKey || col.id;

            if (showDates) {
                // Si es ruta admin, mostramos todo
                return true;
            } else {
                // Si es vista pública, ocultamos explícitamente las de fechas
                return columnId !== 'fechaPagado' && columnId !== 'fechaRecogido';
            }
        });
    }, [isMobile, showDates, rawColumns]);

    const table = useReactTable({
        data: members,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
        },
        initialState: {
            pagination: {
                pageSize: 10,
            }
        }
    });



    return (
        <div className="space-y-4 w-full">
            {/* Toolbar Removed (Now in MemberList) */}

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id} className="px-2 h-9 text-[13px]">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                    className={cn((row.original.pagado && row.original.recogido) && "bg-muted/20")}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="px-2 py-1 text-[13px]">
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No hay resultados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4">
                <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">Filas por página</p>
                    <Select
                        value={`${table.getState().pagination.pageSize}`}
                        onValueChange={(value) => {
                            table.setPageSize(Number(value));
                        }}
                    >
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={table.getState().pagination.pageSize} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[10, 25, 50, 150].map((pageSize) => (
                                <SelectItem key={pageSize} value={`${pageSize}`}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center space-x-2 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                        Página {table.getState().pagination.pageIndex + 1} de{" "}
                        {table.getPageCount()}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            Siguiente
                        </Button>
                    </div>
                </div>
            </div>

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
        </div>
    );
}
