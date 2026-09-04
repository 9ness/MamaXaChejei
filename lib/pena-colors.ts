// Paleta de la peña: "blanco + un color". El admin elige un preset y todo el
// estilo (nav, títulos, chat, botones primarios) se tiñe vía variables CSS.
// Cada preset define los tonos en formato HSL "H S% L%" (compatible con shadcn).

export type PenaColorKey = 'verde' | 'amarillo' | 'rojo' | 'azul' | 'marino' | 'morado' | 'rosa';

export interface PenaPreset {
    key: PenaColorKey;
    label: string;
    /** Color de muestra para el selector (CSS válido). */
    swatch: string;
    vars: {
        primary: string;            // --primary
        primaryForeground: string;  // --primary-foreground (texto sobre primary)
        ring: string;               // --ring
        penaFrom: string;           // stop inicial del degradado de marca
        penaTo: string;             // stop final del degradado de marca
    };
}

export const DEFAULT_PENA_COLOR: PenaColorKey = 'verde';

export const PENA_PRESETS: Record<PenaColorKey, PenaPreset> = {
    verde: {
        key: 'verde',
        label: 'Verde',
        swatch: 'hsl(142 72% 38%)',
        vars: {
            primary: '142 72% 38%',
            primaryForeground: '0 0% 100%',
            ring: '142 72% 38%',
            penaFrom: '142 70% 45%',
            penaTo: '160 84% 28%',
        },
    },
    amarillo: {
        key: 'amarillo',
        label: 'Amarillo',
        swatch: 'hsl(43 96% 48%)',
        vars: {
            primary: '43 96% 45%',
            primaryForeground: '40 100% 12%', // texto oscuro para contraste
            ring: '43 96% 45%',
            penaFrom: '45 96% 55%',
            penaTo: '38 92% 45%',
        },
    },
    rojo: {
        key: 'rojo',
        label: 'Rojo',
        swatch: 'hsl(0 72% 48%)',
        vars: {
            primary: '0 72% 48%',
            primaryForeground: '0 0% 100%',
            ring: '0 72% 48%',
            penaFrom: '0 84% 58%',
            penaTo: '350 78% 42%',
        },
    },
    azul: {
        key: 'azul',
        label: 'Azul',
        swatch: 'hsl(217 85% 50%)',
        vars: {
            primary: '217 85% 50%',
            primaryForeground: '0 0% 100%',
            ring: '217 85% 50%',
            penaFrom: '213 92% 58%',
            penaTo: '230 78% 46%',
        },
    },
    // El azul marino de las mangas de la camiseta de J'26.
    marino: {
        key: 'marino',
        label: 'Marino J\'26',
        swatch: 'hsl(232 62% 30%)',
        vars: {
            primary: '232 62% 30%',
            primaryForeground: '0 0% 100%',
            ring: '232 62% 30%',
            penaFrom: '232 58% 38%',
            penaTo: '228 70% 20%',
        },
    },
    morado: {
        key: 'morado',
        label: 'Morado',
        swatch: 'hsl(262 83% 58%)',
        vars: {
            primary: '262 83% 58%',
            primaryForeground: '210 40% 98%',
            ring: '262 83% 58%',
            penaFrom: '330 81% 58%',
            penaTo: '262 83% 58%',
        },
    },
    rosa: {
        key: 'rosa',
        label: 'Rosa',
        swatch: 'hsl(330 78% 52%)',
        vars: {
            primary: '330 78% 52%',
            primaryForeground: '0 0% 100%',
            ring: '330 78% 52%',
            penaFrom: '330 82% 60%',
            penaTo: '300 76% 48%',
        },
    },
};

export function getPenaPreset(key?: string | null): PenaPreset {
    if (key && key in PENA_PRESETS) return PENA_PRESETS[key as PenaColorKey];
    return PENA_PRESETS[DEFAULT_PENA_COLOR];
}

/** Genera el CSS que sobreescribe las variables de tema en :root y .dark */
export function penaColorStyle(key?: string | null): string {
    const { vars } = getPenaPreset(key);
    const decl = `--primary:${vars.primary};--primary-foreground:${vars.primaryForeground};--ring:${vars.ring};--pena-from:${vars.penaFrom};--pena-to:${vars.penaTo};`;
    return `:root{${decl}}.dark{${decl}}`;
}
