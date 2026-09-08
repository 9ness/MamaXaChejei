'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, List, MapPin, Images, Ticket, ShieldCheck, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
    href: string;
    label: string;
    icon: LucideIcon;
}

const BASE_ITEMS: NavItem[] = [
    { href: '/', label: 'Inicio', icon: Home },
    { href: '/lista', label: 'Lista', icon: List },
    { href: '/mapa', label: 'Mapa', icon: MapPin },
    // "Fotos" y no "Recuerdos": con 6 pestañas la palabra larga se comía su hueco
    // y dejaba sin aire a la de al lado. La sección se sigue llamando Recuerdos.
    { href: '/recuerdos', label: 'Fotos', icon: Images },
    { href: '/lupebet', label: 'LupeBet', icon: Ticket },
];

const ADMIN_ITEM: NavItem = { href: '/gestion', label: 'Gestión', icon: ShieldCheck };

export function BottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
    const pathname = usePathname();
    const items = isAdmin ? [...BASE_ITEMS, ADMIN_ITEM] : BASE_ITEMS;

    const isActive = (href: string) =>
        href === '/' ? pathname === '/' : pathname.startsWith(href);

    return (
        <>
            {/* Desktop: barra superior */}
            <nav className="hidden md:block sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
                <div className="container mx-auto max-w-5xl flex items-center gap-1 px-4 h-14">
                    <span className="mr-4 font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--pena-from))] to-[hsl(var(--pena-to))]">
                        MXC
                    </span>
                    {items.map(({ href, label, icon: Icon }) => {
                        const active = isActive(href);
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                    active
                                        ? "text-primary bg-primary/10"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Móvil: barra inferior fija */}
            <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
                {/* Las columnas son exactamente iguales (1fr cada una), así que los
                    iconos van siempre a la misma distancia. Lo que se apelotona a 6
                    huecos son las ETIQUETAS: "Recuerdos" casi llena sus ~65px y deja
                    sin aire a la de al lado, mientras "Mapa" sobra por todos lados.
                    Por eso a 6 se baja el cuerpo de letra, para devolver el hueco. */}
                <div
                    className={cn(
                        "grid",
                        items.length >= 6 ? "grid-cols-6" : items.length === 5 ? "grid-cols-5" : "grid-cols-4",
                    )}
                >
                    {items.map(({ href, label, icon: Icon }) => {
                        const active = isActive(href);
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-0.5 py-2 px-0.5 font-medium transition-colors",
                                    items.length >= 6 ? "text-[9px] tracking-tight" : "text-[10px]",
                                    active ? "text-primary" : "text-muted-foreground"
                                )}
                            >
                                <Icon className={cn("w-5 h-5", active && "scale-110 transition-transform")} />
                                <span className="leading-none truncate max-w-full">{label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </>
    );
}
