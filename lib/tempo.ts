/**
 * "fai 38 minutos", "fai 2 días"… y a partir de una semana, la fecha. Recibe el
 * "ahora" como parámetro a propósito: así es una función pura y se puede
 * calcular en el cliente sin que el servidor pinte una hora distinta y rompa la
 * hidratación.
 */
const MESES = [
    'xaneiro', 'febreiro', 'marzo', 'abril', 'maio', 'xuño',
    'xullo', 'agosto', 'setembro', 'outubro', 'novembro', 'decembro',
];

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;
const SEMANA = 7 * DIA;

export function fai(ts: number, agora: number): string {
    const d = agora - ts;
    if (!Number.isFinite(d)) return '';
    if (d < MINUTO) return 'agora mesmo';
    if (d < HORA) {
        const n = Math.floor(d / MINUTO);
        return `fai ${n} minuto${n === 1 ? '' : 's'}`;
    }
    if (d < DIA) {
        const n = Math.floor(d / HORA);
        return `fai ${n} hora${n === 1 ? '' : 's'}`;
    }
    if (d < SEMANA) {
        const n = Math.floor(d / DIA);
        return n === 1 ? 'onte' : `fai ${n} días`;
    }

    const f = new Date(ts);
    const mesmoAno = f.getFullYear() === new Date(agora).getFullYear();
    const data = `${f.getDate()} de ${MESES[f.getMonth()]}`;
    return mesmoAno ? data : `${data} de ${f.getFullYear()}`;
}
