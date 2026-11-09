/**
 * "A Guadalupe en cifras": o resumo da festa, sacado do que xa hai gardado
 * (fotos, 🔥, cancións, chat, xogo e LupeBet). Aquí só se fan contas: non se
 * le nin se escribe nada en Redis, os datos chegan xa lidos desde a páxina.
 * Por iso é unha función pura e se pode probar sen servidor.
 */
import type { AudioPena, Foto, HighScore, PostoRanking } from '@/app/actions';
import { DIAS_FESTA, diaDaFoto } from '@/lib/festas';
import { fotoId } from '@/lib/fotos';
import type { Boleto } from '@/lib/lupebet';

export interface DatosResumo {
    fotos: Foto[];
    likes: Record<string, number>;
    audios: AudioPena[];
    likesAudios: Record<string, number>;
    boletos: Boleto[];
    xogo: HighScore[];
    moedas: PostoRanking[];
    /** Mensaxes publicadas no chat desde que hai contador. */
    mensaxes: number;
    /** Partidas botadas ao xogo das cervexas. */
    partidas: number;
}

export interface FotoPodio extends Foto {
    lumes: number;
}

export interface DiaResumo {
    id: string;
    etiqueta: string;
    alcume?: string;
    fotos: number;
}

export interface Resumo {
    cifras: {
        fotos: number;
        lumes: number;
        cancions: number;
        mensaxes: number;
        partidas: number;
        boletos: number;
        moedasApostadas: number;
    };
    /** As tres fotos con máis 🔥 (só as que teñen algún). */
    podioFotos: FotoPodio[];
    /** Fotos por xornada, na orde da festa. Só as xornadas con algunha foto
     *  e, entre a primeira e a última, tamén as baleiras: o oco conta. */
    porDia: DiaResumo[];
    /** A xornada con máis fotos. */
    diaTop: DiaResumo | null;
    cancionTop: { titulo: string; lumes: number } | null;
    /** O boleto no que máis moedas se xogaron. */
    boletoTop: { id: string; titulo: string; nombre: string; apostado: number; apostantes: number } | null;
    boletosPechados: { ganados: number; perdidos: number };
    xogo: HighScore[];
    moedas: PostoRanking[];
    /** Non hai nada que contar (Redis baleiro ou caído): a páxina dío e xa. */
    baleiro: boolean;
}

const enteiro = (n: unknown) => {
    const v = Math.floor(Number(n));
    return Number.isFinite(v) && v > 0 ? v : 0;
};

export function calcularResumo(d: DatosResumo): Resumo {
    const fotos = d.fotos ?? [];
    const audios = d.audios ?? [];
    const boletos = d.boletos ?? [];

    // Só contan os 🔥 das fotos que seguen no mural: os contadores das
    // borradas xa se limpan, pero se quedase algún colgado non debe sumar.
    const conLumes: FotoPodio[] = fotos.map((f) => ({ ...f, lumes: enteiro(d.likes?.[fotoId(f.url)]) }));
    const lumesFotos = conLumes.reduce((s, f) => s + f.lumes, 0);

    const podioFotos = conLumes
        .filter((f) => f.lumes > 0)
        // A igualdade de 🔥, a máis antiga: chegou antes a ese número.
        .sort((a, b) => b.lumes - a.lumes || a.ts - b.ts)
        .slice(0, 3);

    const contas = new Map<string, number>();
    for (const f of fotos) {
        const dia = diaDaFoto(f.ts);
        contas.set(dia, (contas.get(dia) ?? 0) + 1);
    }
    const todos: DiaResumo[] = DIAS_FESTA.map((dia) => ({
        id: dia.id,
        etiqueta: dia.etiqueta,
        ...(dia.alcume ? { alcume: dia.alcume } : {}),
        fotos: contas.get(dia.id) ?? 0,
    }));
    const primeiro = todos.findIndex((x) => x.fotos > 0);
    const ultimo = todos.findLastIndex((x) => x.fotos > 0);
    const porDia = primeiro === -1 ? [] : todos.slice(primeiro, ultimo + 1);
    // O primeiro que chegue ao máximo: en empate manda a orde da festa.
    const diaTop = porDia.reduce<DiaResumo | null>((mellor, x) => (x.fotos > (mellor?.fotos ?? 0) ? x : mellor), null);

    const cancions = audios.map((a) => ({ titulo: a.titulo || 'Sen título', lumes: enteiro(d.likesAudios?.[fotoId(a.url)]) }));
    const lumesAudios = cancions.reduce((s, c) => s + c.lumes, 0);
    const cancionTop = cancions.reduce<{ titulo: string; lumes: number } | null>(
        (mellor, c) => (c.lumes > (mellor?.lumes ?? 0) ? c : mellor),
        null,
    );

    const moedasApostadas = boletos.reduce((s, b) => s + enteiro(b.apostado), 0);
    const maisXogado = boletos.reduce<Boleto | null>(
        (mellor, b) => (enteiro(b.apostado) > enteiro(mellor?.apostado) ? b : mellor),
        null,
    );
    const boletoTop = maisXogado
        ? {
            id: maisXogado.id,
            titulo: maisXogado.titulo,
            nombre: maisXogado.nombre,
            apostado: enteiro(maisXogado.apostado),
            apostantes: enteiro(maisXogado.apostantes),
        }
        : null;

    const cifras = {
        fotos: fotos.length,
        lumes: lumesFotos + lumesAudios,
        cancions: audios.length,
        mensaxes: enteiro(d.mensaxes),
        partidas: enteiro(d.partidas),
        boletos: boletos.length,
        moedasApostadas,
    };

    const xogo = (d.xogo ?? []).filter((x) => x.score > 0).slice(0, 3);
    const moedas = (d.moedas ?? []).slice(0, 3);

    return {
        cifras,
        podioFotos,
        porDia,
        diaTop,
        cancionTop,
        boletoTop,
        boletosPechados: {
            ganados: boletos.filter((b) => b.estado === 'ganado').length,
            perdidos: boletos.filter((b) => b.estado === 'perdido').length,
        },
        xogo,
        moedas,
        baleiro: Object.values(cifras).every((n) => n === 0) && xogo.length === 0 && moedas.length === 0,
    };
}

/** 1234567 → "1.234.567". A man: toLocaleString non pinta igual en Vercel (UTC,
 *  sen datos de idioma completos) que no móbil, e rompe a hidratación. */
export function miles(n: number): string {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
