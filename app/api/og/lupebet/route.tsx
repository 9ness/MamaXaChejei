import { ImageResponse } from 'next/og';
import { getBoleto } from '@/app/actions';
import { BOLETO_OFICIAL, LUPE_AZUL, cuotaTotal, eur, ganancia, mercadoBoleto } from '@/lib/lupebet';

// La imagen que se comparte por WhatsApp/redes: el boleto en blanco y azul
// marino. /api/og/lupebet?b=<id>  (sin b → el boleto oficial de la camiseta)

export const runtime = 'nodejs';

const W = 1200;
const H = 630;
// Con la banda de arriba, el pie y las cuotas, cuatro líneas es lo que entra
// sin apelotonarse. El resto se resume en un "+N liñas máis".
const MAX_LINEAS_VISIBLES = 4;

const ALTO_CABECEIRA = 132;
const ALTO_PE = 112;
const PADDING_Y = 20;
const GAP_FILA = 10;
// La fila de abajo lleva las cuotas y, si sobran líneas, el "+N liñas máis".
const ALTO_APOSTAS = 64;

function entre(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, Math.round(n)));
}

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
    const mercado = mercadoBoleto(lineas);

    const visibles = lineas.slice(0, MAX_LINEAS_VISIBLES);
    const ocultas = lineas.length - visibles.length;

    // Un boleto de una línea dejaba media imagen en blanco y quedaba pobre: las
    // filas se reparten el hueco que queda y la tipografía crece con ellas. El
    // tope de 150 es para que una sola línea no salga como un cartel.
    const dispo = H - ALTO_CABECEIRA - ALTO_PE - PADDING_Y * 2 - ALTO_APOSTAS;
    // Con una sola línea se deja crecer más: si no, queda una tarjeta pequeña
    // flotando en medio de la imagen, que es justo lo que se veía cutre.
    const tope = visibles.length === 1 ? 230 : 150;
    const alto = Math.min(tope, Math.floor(dispo / visibles.length) - GAP_FILA);
    const apuesta = entre(alto * 0.3, 20, 44);
    const pronostico = entre(alto * 0.19, 15, 30);
    const e = {
        alto,
        apuesta,
        pronostico,
        cuota: entre(alto * 0.44, 28, 66),
        // El relleno sale de lo que sobra: así la fila mide exactamente `alto`
        // y nunca se derrama por fuera de la imagen.
        pad: Math.max(4, Math.floor((alto - (apuesta * 1.15 + 6 + pronostico)) / 2)),
    };
    // Con el texto grande caben menos letras por línea.
    const corteApuesta = Math.round(2100 / e.apuesta);

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
                        justifyContent: 'center',
                        padding: '20px 48px',
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
                                borderRadius: 16,
                                padding: `${e.pad}px 24px`,
                                marginBottom: 10,
                                minHeight: e.alto,
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    width: Math.round(e.apuesta * 1.3),
                                    height: Math.round(e.apuesta * 1.3),
                                    borderRadius: 10,
                                    background: LUPE_AZUL,
                                    color: '#ffffff',
                                    fontSize: Math.round(e.apuesta * 0.8),
                                    fontWeight: 700,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 20,
                                }}
                            >
                                {i + 1}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                <div style={{ display: 'flex', fontSize: e.apuesta, fontWeight: 700, lineHeight: 1.15 }}>
                                    {corta(l.apuesta, corteApuesta)}
                                </div>
                                {l.pronostico ? (
                                    <div
                                        style={{
                                            display: 'flex',
                                            fontSize: e.pronostico,
                                            marginTop: 6,
                                            opacity: 0.65,
                                        }}
                                    >
                                        {corta(l.pronostico, 36)}
                                    </div>
                                ) : null}
                            </div>
                            <div style={{ display: 'flex', fontSize: e.cuota, fontWeight: 700, marginLeft: 20 }}>
                                {eur(l.cuota)}
                            </div>
                        </div>
                    ))}

                    {/* Las líneas que no caben y las dos cuotas, en la misma
                        fila: es lo que hace que a quien lo recibe le entren
                        ganas de entrar y apostar. */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            height: ALTO_APOSTAS,
                        }}
                    >
                        <div style={{ display: 'flex', fontSize: 22, marginLeft: 8, opacity: 0.7 }}>
                            {ocultas > 0
                                ? `+${ocultas} liña${ocultas === 1 ? '' : 's'} máis`
                                : 'XOJA CON RESPONSABILIDADE'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div
                                style={{
                                    display: 'flex',
                                    background: '#E8F5EC',
                                    color: '#14713C',
                                    borderRadius: 999,
                                    padding: '8px 22px',
                                    fontSize: 26,
                                    fontWeight: 700,
                                    marginRight: 12,
                                }}
                            >
                                SI ×{eur(mercado.baseSi)}
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    background: '#FBEAEA',
                                    color: '#9B1C1C',
                                    borderRadius: 999,
                                    padding: '8px 22px',
                                    fontSize: 26,
                                    fontWeight: 700,
                                }}
                            >
                                NON ×{eur(mercado.baseNon)}
                            </div>
                        </div>
                    </div>
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
