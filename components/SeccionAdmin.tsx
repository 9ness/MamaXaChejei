import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * Bloque plegable de /gestion. Los ajustes que casi nunca se tocan (color de la
 * peña, PIN, pegar la lista entera) ocupaban media pantalla cada uno y había
 * que hacer scroll a ciegas para llegar a la lista, que es lo que se usa.
 * `<details>` nativo: sin estado ni JavaScript de por medio.
 */
export function SeccionAdmin({
    titulo,
    pista,
    children,
    abierta = false,
}: {
    titulo: string;
    /** Una línea de contexto, a la derecha del título. */
    pista?: string;
    children: ReactNode;
    abierta?: boolean;
}) {
    return (
        <details open={abierta} className="group bg-card rounded-lg border shadow-sm">
            <summary className="cursor-pointer list-none flex items-center gap-2 px-4 py-3">
                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                <span className="font-semibold">{titulo}</span>
                {pista && (
                    <span className="ml-auto text-xs text-muted-foreground truncate">{pista}</span>
                )}
            </summary>
            <div className="px-4 pb-4">{children}</div>
        </details>
    );
}
