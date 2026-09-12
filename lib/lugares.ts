// Os sitios da festa: onde cae cada acto do itinerario.
//
// Dúas metades:
//   · O CATÁLOGO (aquí abaixo) son os nomes que aparecen no cartel. É texto,
//     non cambia sen que cambie o programa.
//   · ONDE CAE cada un (coordenadas + icona) NON está aquí: gárdao o admin
//     tocando no mapa e vive en Redis (`fiesta:lugares`, ver app/actions.ts).
//
// Mentres un sitio non estea colocado no mapa, o itinerario segue amosando só
// o seu nome en texto, sen botóns, e non sae ningunha chincheta.

export interface LugarBase {
    /** slug estable: vai na URL /mapa?lugar=<id>. Non o cambies sen motivo. */
    id: string;
    /** Como se escribe no cartel (ten que coincidir co `lugar` de lib/itinerario.ts). */
    nome: string;
    /** Icona suxerida ao colocalo por primeira vez. O admin pode cambiala. */
    emoji: string;
}

/** O que garda o admin de cada sitio (unha entrada da HASH de Redis). */
export interface LugarGardado {
    lat: number;
    lng: number;
    emoji: string;
}

/** Sitio do cartel que xa ten sitio no mapa. */
export type Lugar = LugarBase & { lat: number; lng: number };

/** Todos os `lugar:` distintos que aparecen en lib/itinerario.ts. */
export const LUGARES_BASE: LugarBase[] = [
    { id: 'praza-castelao', nome: 'Praza Castelao', emoji: '🎪' },
    { id: 'praza-igrexa', nome: 'Praza da Igrexa', emoji: '⛪' },
    { id: 'capela-guadalupe', nome: 'Capela de Guadalupe', emoji: '🕯️' },
    { id: 'praza-virxe', nome: 'Praza Virxe de Guadalupe', emoji: '🙏' },
    { id: 'paseo-ribeira', nome: 'Paseo da Ribeira', emoji: '🌊' },
    { id: 'xardins-ribeira', nome: 'Xardíns da Ribeira', emoji: '🏞️' },
    // Non é campo de fútbol: é unha carballeira, árbores de folla caduca.
    { id: 'campo-arriba', nome: 'Campo de Arriba', emoji: '🍂' },
    { id: 'auditorio', nome: 'Auditorio', emoji: '🎭' },
    { id: 'concello', nome: 'Salón de Plenos do Concello', emoji: '🏛️' },
    { id: 'rua-medio', nome: 'Rúa do Medio', emoji: '🍹' },
    { id: 'rua-abaixo', nome: 'Rúa de Abaixo', emoji: '🎉' },
    { id: 'casco-vello', nome: 'Casco vello da vila', emoji: '🏘️' },
];

/**
 * As iconas que pode elixir o admin. É unha LISTA PECHADA a propósito: o emoji
 * acaba dentro do HTML da chincheta de Leaflet, así que texto libre do usuario
 * aí sería un buraco (mesmo criterio que a paleta de lib/pena-colors.ts).
 */
export const EMOJIS_LUGAR = [
    '📍', '🎪', '⛪', '🕯️', '🙏', '🎭', '🏛️', '🎶', '🎺', '🎸',
    '🍂', '🌳', '🏞️', '🌊', '⚓', '🦀', '🍻', '🍹', '🍽️', '🎡',
    '🎆', '🎉', '🏘️', '⚽', '🏃', '🐂', '🛍️', '🚻',
] as const;

export function emojiValido(e: string): boolean {
    return (EMOJIS_LUGAR as readonly string[]).includes(e);
}

/** Para comparar textos do cartel sen que molesten acentos nin maiúsculas. */
function normalizar(s: string): string {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

const POR_TEXTO = new Map(LUGARES_BASE.map(l => [normalizar(l.nome), l]));
const POR_ID = new Map(LUGARES_BASE.map(l => [l.id, l]));

export function basePorId(id?: string | null): LugarBase | undefined {
    return id ? POR_ID.get(id) : undefined;
}

/** O que garda o admin, tal cal sae de Redis: id → posición + icona. */
export type LugaresGardados = Record<string, LugarGardado>;

/** Xunta o catálogo co gardado: só os sitios que xa teñen sitio no mapa. */
export function lugaresColocados(gardados: LugaresGardados): Lugar[] {
    return LUGARES_BASE.flatMap(base => {
        const g = gardados[base.id];
        if (!g) return [];
        return [{ ...base, emoji: g.emoji || base.emoji, lat: g.lat, lng: g.lng }];
    });
}

/** Busca polo texto `lugar` dun acto do itinerario. Devolve undefined se aínda non está colocado. */
export function buscarLugar(texto: string | undefined, gardados: LugaresGardados): Lugar | undefined {
    if (!texto) return undefined;
    const base = POR_TEXTO.get(normalizar(texto));
    if (!base) return undefined;
    const g = gardados[base.id];
    if (!g) return undefined;
    return { ...base, emoji: g.emoji || base.emoji, lat: g.lat, lng: g.lng };
}

/** O mapa da propia web, centrado nese sitio. */
export function mapaUrl(l: { id: string }): string {
    return `/mapa?lugar=${encodeURIComponent(l.id)}`;
}

/** Google Maps a pé: todo queda dentro da vila. */
export function mapsUrl(l: { lat: number; lng: number }): string {
    const params = new URLSearchParams({
        api: '1',
        destination: `${l.lat},${l.lng}`,
        travelmode: 'walking',
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
}
