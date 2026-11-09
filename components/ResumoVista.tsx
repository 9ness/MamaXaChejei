import Link from 'next/link';
import { Flame, Images } from 'lucide-react';
import { MeuResumo } from '@/components/MeuResumo';
import { BotonCompartir } from '@/components/BotonCompartir';
import { ANO_FESTA } from '@/lib/festas';
import { miles, type Resumo } from '@/lib/resumo';

const MEDALLAS = ['🥇', '🥈', '🥉'];

function Cifra({ valor, etiqueta, icono }: { valor: number; etiqueta: string; icono: string }) {
    if (valor <= 0) return null;
    return (
        <div className="rounded-lg border bg-card shadow-sm px-3 py-3 text-center">
            <div className="text-lg leading-none" aria-hidden>{icono}</div>
            <div className="text-2xl font-black tabular-nums mt-1">{miles(valor)}</div>
            <div className="text-[11px] font-medium text-muted-foreground leading-tight mt-0.5">{etiqueta}</div>
        </div>
    );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <section className="rounded-lg border bg-card shadow-sm p-4">
            <h2 className="text-sm font-bold mb-3">{titulo}</h2>
            {children}
        </section>
    );
}

/**
 * O debuxo do resumo. Vai aparte da páxina para que esta só lea os datos: así
 * a vista non sabe nada de Redis e pódese pintar con calquera `Resumo`.
 */
export function ResumoVista({ r, likes }: { r: Resumo; likes: Record<string, number> }) {
    const maxDia = Math.max(1, ...r.porDia.map((d) => d.fotos));

    if (r.baleiro) {
        return (
            <p className="text-center text-muted-foreground py-16">
                Aínda non hai nada que contar. Cando a peña suba fotos, cancións e boletos, o resumo sae aquí só.
            </p>
        );
    }

    return (
        <div className="space-y-4">
            {/* Con número impar de cifras, a última ocupa a fila enteira no móbil. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
                <Cifra icono="📸" valor={r.cifras.fotos} etiqueta="fotos no mural" />
                <Cifra icono="🔥" valor={r.cifras.lumes} etiqueta="lumes dados" />
                <Cifra icono="🎵" valor={r.cifras.cancions} etiqueta="cancións da peña" />
                <Cifra icono="💬" valor={r.cifras.mensaxes} etiqueta="mensaxes no chat" />
                <Cifra icono="🍺" valor={r.cifras.partidas} etiqueta="partidas ao xogo" />
                <Cifra icono="🎟️" valor={r.cifras.boletos} etiqueta="boletos de LupeBet" />
                <Cifra icono="🪙" valor={r.cifras.moedasApostadas} etiqueta="moedas apostadas" />
            </div>

            <MeuResumo likes={likes} />

            {r.podioFotos.length > 0 && (
                <Bloque titulo="As fotos que máis prenderon">
                    <ol className="grid grid-cols-3 gap-2">
                        {r.podioFotos.map((f, i) => (
                            <li key={f.url} className="min-w-0">
                                <Link href="/recuerdos" className="block">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={f.url}
                                        alt={f.titulo || `Foto número ${i + 1} en lumes`}
                                        loading="lazy"
                                        className="w-full aspect-square object-cover rounded-md border"
                                    />
                                </Link>
                                <p className="flex items-center justify-center gap-1 text-sm font-bold mt-1.5 tabular-nums">
                                    <span aria-hidden>{MEDALLAS[i]}</span>
                                    {f.lumes}
                                    <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-400" aria-label="lumes" />
                                </p>
                                {f.titulo && (
                                    <p className="text-[11px] text-muted-foreground text-center leading-snug line-clamp-2">
                                        {f.titulo}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ol>
                </Bloque>
            )}

            {r.porDia.length > 1 && (
                <Bloque titulo="Fotos por xornada">
                    <ul className="space-y-1.5">
                        {r.porDia.map((d) => {
                            const eTop = d.id === r.diaTop?.id;
                            return (
                                <li
                                    key={d.id}
                                    title={`${d.etiqueta}: ${d.fotos} foto${d.fotos === 1 ? '' : 's'}`}
                                    className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2 text-xs"
                                >
                                    <span className={eTop ? 'font-bold truncate' : 'text-muted-foreground truncate'}>
                                        {d.etiqueta}
                                    </span>
                                    <span className="h-2.5 rounded-r-[4px] bg-muted/60">
                                        <span
                                            className="block h-full rounded-r-[4px] bg-primary"
                                            style={{ width: `${(d.fotos / maxDia) * 100}%`, opacity: eTop ? 1 : 0.55 }}
                                        />
                                    </span>
                                    <span className={`text-right tabular-nums ${eTop ? 'font-bold' : 'text-muted-foreground'}`}>
                                        {d.fotos}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                    {r.diaTop && (
                        <p className="text-xs text-muted-foreground mt-3">
                            A xornada con máis fotos foi <span className="font-bold text-foreground">
                                {r.diaTop.etiqueta}{r.diaTop.alcume ? ` (${r.diaTop.alcume})` : ''}
                            </span>. As de madrugada contan para a noite anterior.
                        </p>
                    )}
                </Bloque>
            )}

            {r.xogo.length > 0 && (
                <Bloque titulo="O xogo das cervexas">
                    <ol className="space-y-1.5">
                        {r.xogo.map((x, i) => (
                            <li key={x.name} className="flex items-center gap-2 text-sm">
                                <span aria-hidden>{MEDALLAS[i]}</span>
                                <span className="font-semibold truncate">{x.name}</span>
                                <span className="ml-auto tabular-nums font-bold">{miles(x.score)}</span>
                            </li>
                        ))}
                    </ol>
                </Bloque>
            )}

            {(r.moedas.length > 0 || r.boletoTop) && (
                <Bloque titulo="LupeBet">
                    {r.moedas.length > 0 && (
                        <ol className="space-y-1.5">
                            {r.moedas.map((m, i) => (
                                <li key={`${m.nombre}-${i}`} className="flex items-center gap-2 text-sm">
                                    <span aria-hidden>{MEDALLAS[i]}</span>
                                    <span className="font-semibold truncate">{m.nombre}</span>
                                    <span className="ml-auto tabular-nums font-bold">{miles(m.saldo)} 🪙</span>
                                </li>
                            ))}
                        </ol>
                    )}
                    {r.boletoTop && (
                        <p className="text-xs text-muted-foreground mt-3">
                            O boleto máis xogado:{' '}
                            <Link href={`/lupebet/${encodeURIComponent(r.boletoTop.id)}`} className="font-bold text-primary underline underline-offset-2">
                                {r.boletoTop.titulo}
                            </Link>{' '}
                            de {r.boletoTop.nombre}, con {miles(r.boletoTop.apostado)} moedas
                            {r.boletoTop.apostantes > 0 && ` de ${r.boletoTop.apostantes} apostante${r.boletoTop.apostantes === 1 ? '' : 's'}`}.
                        </p>
                    )}
                    {(r.boletosPechados.ganados > 0 || r.boletosPechados.perdidos > 0) && (
                        <p className="text-xs text-muted-foreground mt-1">
                            Boletos pechados: {r.boletosPechados.ganados} gañado{r.boletosPechados.ganados === 1 ? '' : 's'} e{' '}
                            {r.boletosPechados.perdidos} perdido{r.boletosPechados.perdidos === 1 ? '' : 's'}.
                        </p>
                    )}
                </Bloque>
            )}

            {r.cancionTop && (
                <Bloque titulo="A canción da peña">
                    <p className="text-sm">
                        <span className="font-semibold">{r.cancionTop.titulo}</span>
                        <span className="text-muted-foreground"> · {r.cancionTop.lumes} 🔥</span>
                    </p>
                </Bloque>
            )}

            <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Link
                    href="/recuerdos"
                    className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold shadow-sm active:scale-95 transition-transform"
                >
                    <Images className="w-4 h-4" /> Ver todas as fotos
                </Link>
                <BotonCompartir
                    titulo={`A Guadalupe ${ANO_FESTA} en cifras`}
                    texto={`A Guadalupe ${ANO_FESTA} de Mamá xa Chejei: ${miles(r.cifras.fotos)} fotos e ${miles(r.cifras.lumes)} lumes.`}
                />
            </div>
        </div>
    );
}
