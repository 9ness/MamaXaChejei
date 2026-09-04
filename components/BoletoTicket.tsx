import { Archivo_Narrow } from 'next/font/google';
import { type BoletoLinea, LUPE_AZUL, barcodeWidths, cuotaTotal, eur, ganancia } from '@/lib/lupebet';

// La camiseta usa una condensada pesada; Geist no tiene condensada, así que el
// ticket (y solo el ticket) carga esta.
const ticket = Archivo_Narrow({ subsets: ['latin'], weight: ['500', '700'] });

interface BoletoTicketProps {
    titulo: string;
    idBoleto: string;
    codigo: string;
    fecha: string;
    lineas: BoletoLinea[];
    importe: number;
    /** El oficial trae sus totales impresos; los de la peña se calculan. */
    cuotaTotal?: number;
    ganancia?: number;
    estado?: string;
    nombre?: string;
}

function Fila({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-3">
            <span className="font-bold uppercase opacity-60">{label}</span>
            <span className="text-right font-bold">{value}</span>
        </div>
    );
}

/** Réplica del boleto de la espalda de la camiseta, en blanco y azul marino.
 *  Sirve para el oficial y para los que se inventa la peña. */
export function BoletoTicket(props: BoletoTicketProps) {
    const { titulo, idBoleto, codigo, fecha, lineas, importe, estado = 'Aceptada', nombre } = props;

    const total = props.cuotaTotal ?? cuotaTotal(lineas);
    const premio = props.ganancia ?? ganancia(importe, lineas);

    return (
        <div
            className={`${ticket.className} w-full max-w-md mx-auto rounded-2xl overflow-hidden bg-white shadow-xl ring-1 ring-black/5`}
            style={{ color: LUPE_AZUL }}
        >
            {/* Cabecera azul, al estilo de las casas de apuestas */}
            <div className="px-5 py-4 text-white" style={{ background: LUPE_AZUL }}>
                <div className="flex items-baseline justify-between gap-3">
                    <p className="text-4xl font-bold italic tracking-tight leading-none">LupeBet</p>
                    <p className="text-sm font-bold tracking-widest whitespace-nowrap">
                        JUADALUPE&rsquo;26
                    </p>
                </div>
                <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.25em] opacity-80">
                    {titulo}
                </p>
            </div>

            <div className="px-5 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px] sm:text-xs">
                    <Fila label="ID boleto:" value={idBoleto} />
                    <Fila label="Tipo de apuesta:" value="Combinada" />
                    <Fila label="Fecha:" value={fecha} />
                    <Fila label="Nº de líneas:" value={String(lineas.length)} />
                    <Fila label="Código:" value={codigo} />
                    <Fila label="Estado:" value={estado} />
                    {nombre && <Fila label="Apostante:" value={nombre} />}
                </div>

                <div className="mt-4 mb-2 flex justify-between text-[10px] font-bold uppercase tracking-wider opacity-60">
                    <span>Línea</span>
                    <span className="flex-1 pl-3">Apuesta</span>
                    <span>Cuota</span>
                </div>

                <ol className="space-y-1.5">
                    {lineas.map((l, i) => (
                        <li
                            key={i}
                            className="flex items-start gap-3 rounded-lg px-3 py-2"
                            style={{ background: `${LUPE_AZUL}0D` }}
                        >
                            <span
                                className="shrink-0 w-6 h-6 rounded-md text-white font-bold text-sm flex items-center justify-center mt-0.5"
                                style={{ background: LUPE_AZUL }}
                            >
                                {i + 1}
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className="block font-bold leading-tight text-sm sm:text-base">
                                    {l.apuesta}
                                </span>
                                {l.pronostico && (
                                    <span className="block text-[11px] leading-tight opacity-70">
                                        {l.pronostico}
                                    </span>
                                )}
                            </span>
                            <span className="shrink-0 font-bold text-lg tabular-nums">{eur(l.cuota)}</span>
                        </li>
                    ))}
                </ol>

                <div className="mt-4 pt-3 border-t-2 border-dashed text-xs space-y-0.5" style={{ borderColor: `${LUPE_AZUL}40` }}>
                    <Fila label="Importe total:" value={`${eur(importe)}€`} />
                    <Fila label="Cuota total:" value={eur(total)} />
                </div>

                <div
                    className="mt-3 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-white"
                    style={{ background: LUPE_AZUL }}
                >
                    <span className="font-bold uppercase text-xs sm:text-sm tracking-wide">
                        Posible ganancia
                    </span>
                    <span className="font-bold text-2xl sm:text-3xl tabular-nums">{eur(premio)}€</span>
                </div>

                <div className="mt-4 flex justify-center items-end gap-[2px] h-9" aria-hidden>
                    {barcodeWidths(codigo).map((w, i) => (
                        <span
                            key={i}
                            className="h-full rounded-[1px]"
                            style={{ width: `${w}px`, background: LUPE_AZUL, opacity: i % 3 === 0 ? 1 : 0.75 }}
                        />
                    ))}
                </div>
                <p className="text-center text-[10px] mt-1 tracking-widest opacity-70">{idBoleto}</p>

                <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-wide opacity-70">
                    Xoja e bebe con responsabilidade{' '}
                    <span className="inline-block border rounded-full px-1.5 align-middle text-[9px]" style={{ borderColor: LUPE_AZUL }}>
                        +18
                    </span>
                </p>
                <p className="text-center text-[9px] mt-0.5 opacity-60">
                    Mamá xa Chejei advirte de que a Juadalupe crea adicción
                </p>
            </div>
        </div>
    );
}
