import { ImageResponse } from 'next/og';
import { getBoleto } from '@/app/actions';
import { BOLETO_OFICIAL, LUPE_AZUL, cuotaTotal, eur, ganancia } from '@/lib/lupebet';

// La imagen que se comparte por WhatsApp/redes: el boleto en blanco y azul
// marino. /api/og/lupebet?b=<id>  (sin b → el boleto oficial de la camiseta)

export const runtime = 'nodejs';

const W = 1200;
const H = 630;
// A 630px de alto solo caben 5 líneas sin que el pie las pise.
const MAX_LINEAS_VISIBLES = 5;

// Satori no recorta texto: hay que cortarlo a mano.
function corta(s: string, n: number) {
    return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('b') ?? '';
    const boleto = id ? await getBoleto(id) : null;

    const titulo = boleto ? boleto.titulo : BOLETO_OFICIAL.titulo;
    const quien = boleto ? boleto.nombre : 'O da camiseta';
    const lineas = boleto ? boleto.lineas : [...BOLETO_OFICIAL.lineas];
    const total = boleto ? cuotaTotal(boleto.lineas) : BOLETO_OFICIAL.cuotaTotal;
    const premio = boleto ? ganancia(boleto.importe, boleto.lineas) : BOLETO_OFICIAL.ganancia;

    const visibles = lineas.slice(0, MAX_LINEAS_VISIBLES);
    const ocultas = lineas.length - visibles.length;

    return new ImageResponse(
        (
            <div
                style={{
                    width: W,
                    height: H,
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#ffffff',
                    color: LUPE_AZUL,
                }}
            >
                {/* Banda azul de cabecera */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: LUPE_AZUL,
                        color: '#ffffff',
                        padding: '22px 48px',
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: 62, fontWeight: 700, fontStyle: 'italic', lineHeight: 1 }}>
                            LupeBet
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 5, marginTop: 8, opacity: 0.85 }}>
                            {corta(titulo.toUpperCase(), 32)}
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 2 }}>JUADALUPE&rsquo;26</div>
                        <div style={{ fontSize: 30, marginTop: 6 }}>{corta(quien, 24)}</div>
                    </div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        padding: '24px 48px 0',
                        overflow: 'hidden',
                    }}
                >
                    {visibles.map((l, i) => (
                        <div
                            key={i}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: '#F1F3FA',
                                borderRadius: 12,
                                padding: '10px 16px',
                                marginBottom: 8,
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    width: 34,
                                    height: 34,
                                    borderRadius: 8,
                                    background: LUPE_AZUL,
                                    color: '#ffffff',
                                    fontSize: 21,
                                    fontWeight: 700,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 16,
                                }}
                            >
                                {i + 1}
                            </div>
                            <div style={{ display: 'flex', flex: 1, fontSize: 24, fontWeight: 700 }}>
                                {corta(l.apuesta, 44)}
                            </div>
                            <div style={{ display: 'flex', fontSize: 28, fontWeight: 700 }}>{eur(l.cuota)}</div>
                        </div>
                    ))}
                    {ocultas > 0 && (
                        <div style={{ display: 'flex', fontSize: 20, marginLeft: 16, opacity: 0.7 }}>
                            +{ocultas} liña{ocultas === 1 ? '' : 's'} máis
                        </div>
                    )}
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: LUPE_AZUL,
                        color: '#ffffff',
                        padding: '18px 48px',
                    }}
                >
                    <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>
                        CUOTA {eur(total)} · POSIBLE GANANCIA
                    </div>
                    <div style={{ display: 'flex', fontSize: 52, fontWeight: 700 }}>{eur(premio)}€</div>
                </div>
            </div>
        ),
        { width: W, height: H },
    );
}
