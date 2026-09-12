'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { Home, List, MapPin, Images, Ticket, ShieldCheck, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAvisos } from '@/app/actions';
import { AVISOS_VACIOS, aoPedirRefresco, lerVisto, marcarVisto, publicarAvisos, subscribirAvisos, type Avisos } from '@/lib/avisos';

interface NavItem {
    href: string;
    label: string;
    icon: LucideIcon;
}

const BASE_ITEMS: NavItem[] = [
    { href: '/', label: 'Inicio', icon: Home },
    { href: '/mapa', label: 'Mapa', icon: MapPin },
    // "Fotos" y no "Recordos": con 6 pestañas la palabra larga se comía su hueco
    // y dejaba sin aire a la de al lado. La sección se sigue llamando Recordos.
    { href: '/recuerdos', label: 'Fotos', icon: Images },
    { href: '/lupebet', label: 'LupeBet', icon: Ticket },
];

// La lista de tallas es cosa de gestión: solo sale en modo admin. La página
// /lista sigue existiendo y es pública si alguien tiene el enlace.
const ADMIN_ITEMS: NavItem[] = [
    { href: '/lista', label: 'Lista', icon: List },
    { href: '/gestion', label: 'Gestión', icon: ShieldCheck },
];

/**
 * Cada cuánto se pregunta cuando NO estás en el mapa. Dos minutos: son dos
 * comandos de Redis por vuelta y se paga por comando, y para enterarte de que
 * hay gente compartiendo o fotos nuevas no hace falta más fino.
 * En el mapa no se pregunta nada desde aquí: el propio mapa, que ya está
 * mirando, publica cuántos hay.
 */
const CADA = 120_000;

/** El circulito rojo. Más de 9 se queda en "9+", como en todas partes. */
function Insignia({ n }: { n: number }) {
    if (n <= 0) return null;
    return (
        <span className="absolute -top-1 right-1/2 translate-x-[14px] min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold grid place-items-center shadow-sm md:static md:translate-x-0 md:ml-1">
            {n > 9 ? '9+' : n}
        </span>
    );
}

export function BottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
    const pathname = usePathname();
    const items = isAdmin ? [...BASE_ITEMS, ...ADMIN_ITEMS] : BASE_ITEMS;

    const [avisos, setAvisos] = useState<Avisos>(AVISOS_VACIOS);

    // Lo último que vio este móvil. Va por useSyncExternalStore y no por estado
    // propio: en el servidor no hay localStorage, y así se entera al momento
    // cuando otra parte de la app marca algo como visto.
    const vistoFotos = useSyncExternalStore(
        subscribirAvisos,
        () => lerVisto('fotos'),
        () => null,
    );

    // El único que pregunta al servidor: el resto (la insignia del chat) lo lee
    // de lib/avisos.ts. Y solo con la pestaña a la vista, que si no se pasa el
    // día consultando en segundo plano.
    useEffect(() => {
        let vivo = true;

        const mirar = async () => {
            if (document.visibilityState !== 'visible') return;
            if (window.location.pathname.startsWith('/mapa')) return;
            const a = await getAvisos();
            if (!vivo) return;
            setAvisos(a);
            publicarAvisos(a);
        };

        mirar();
        const t = setInterval(mirar, CADA);
        document.addEventListener('visibilitychange', mirar);
        // Y cuando alguien avisa de que acaba de cambiar algo (compartir la
        // ubicación, por ejemplo), se mira sin esperar a la siguiente vuelta.
        const quitar = aoPedirRefresco(mirar);
        return () => {
            vivo = false;
            clearInterval(t);
            document.removeEventListener('visibilitychange', mirar);
            quitar();
        };
    }, []);

    // Estando en Recordos no tiene sentido avisar de fotos nuevas. Y la primera
    // vez de todas se toma nota y no se enseña nada, que si no saldría el total
    // histórico como si fuese nuevo.
    const enRecordos = pathname.startsWith('/recuerdos');
    useEffect(() => {
        if (avisos.fotosN <= 0) return;
        if (enRecordos || vistoFotos === null) marcarVisto('fotos', avisos.fotosN);
    }, [enRecordos, vistoFotos, avisos.fotosN]);

    const fotosSenVer = enRecordos || vistoFotos === null
        ? 0
        : Math.max(0, avisos.fotosN - vistoFotos);

    const insignia = (href: string) => {
        if (href === '/mapa') return avisos.ubicacions;
        if (href === '/recuerdos') return fotosSenVer;
        return 0;
    };

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
                                    "relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                    active
                                        ? "text-primary bg-primary/10"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                                <Insignia n={insignia(href)} />
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Móvil: barra inferior fija */}
            <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
                {/* Las columnas son exactamente iguales (1fr cada una), así que los
                    iconos van siempre a la misma distancia. Lo que se apelotona a 6
                    huecos son las ETIQUETAS: "Recordos" casi llena sus ~65px y deja
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
                                    "relative flex flex-col items-center justify-center gap-0.5 py-2 px-0.5 font-medium transition-colors",
                                    items.length >= 6 ? "text-[9px] tracking-tight" : "text-[10px]",
                                    active ? "text-primary" : "text-muted-foreground"
                                )}
                            >
                                <span className="relative">
                                    <Icon className={cn("w-5 h-5", active && "scale-110 transition-transform")} />
                                    <Insignia n={insignia(href)} />
                                </span>
                                <span className="leading-none truncate max-w-full">{label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </>
    );
}
