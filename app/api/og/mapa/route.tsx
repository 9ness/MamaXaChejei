import { ImageResponse } from 'next/og';

// Miniatura para el enlace compartido por WhatsApp: un trozo del mapa de la
// festa (tiles de OpenStreetMap) centrado en el punto, con un pin encima.
// Se genera al vuelo desde /api/og/mapa?p=lat,lng&n=nombre&c=color

export const runtime = 'nodejs';

const W = 1200;
const H = 630;
const TILE = 256;
const Z = 17; // zoom: ~1 km de ancho, suficiente para "estou aquí"

const FESTA = { lat: 42.6522, lng: -8.8184 };

// Proyección Web Mercator → píxel global en el zoom Z.
function project(lat: number, lng: number, z: number) {
    const scale = TILE * 2 ** z;
    const x = ((lng + 180) / 360) * scale;
    const s = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
    const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
    return { x, y };
}

async function tileDataUrl(z: number, x: number, y: number): Promise<string | null> {
    const max = 2 ** z;
    if (x < 0 || y < 0 || x >= max || y >= max) return null;
    const sub = ['a', 'b', 'c'][((x % 3) + (y % 3)) % 3];
    const url = `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
    try {
        const res = await fetch(url, {
            headers: {
                // OSM exige un User-Agent identificable (uso bajo: peña de ~30 personas).
                'User-Agent': 'MamaXaChejei/1.0 (festa peña app; ness4b@gmail.com)',
            },
        });
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        return `data:image/png;base64,${buf.toString('base64')}`;
    } catch {
        return null;
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const n = (searchParams.get('n') ?? '').slice(0, 40);
    const c = searchParams.get('c') || '#ef4444';
    const color = /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#ef4444';

    const [latS, lngS] = (searchParams.get('p') ?? '').split(',');
    let lat = parseFloat(latS);
    let lng = parseFloat(lngS);
    if (!isFinite(lat) || !isFinite(lng)) {
        lat = FESTA.lat;
        lng = FESTA.lng;
    }

    const { x: px, y: py } = project(lat, lng, Z);
    const offsetX = px - W / 2;
    const offsetY = py - H / 2;
    const minTx = Math.floor(offsetX / TILE);
    const maxTx = Math.floor((offsetX + W) / TILE);
    const minTy = Math.floor(offsetY / TILE);
    const maxTy = Math.floor((offsetY + H) / TILE);

    const jobs: { tx: number; ty: number; left: number; top: number }[] = [];
    for (let tx = minTx; tx <= maxTx; tx++) {
        for (let ty = minTy; ty <= maxTy; ty++) {
            jobs.push({ tx, ty, left: tx * TILE - offsetX, top: ty * TILE - offsetY });
        }
    }

    const tiles = await Promise.all(
        jobs.map(async (j) => ({ ...j, src: await tileDataUrl(Z, j.tx, j.ty) })),
    );

    const titulo = n ? `${n} está aquí` : 'Estou aquí';

    return new ImageResponse(
        (
            <div
                style={{
                    width: W,
                    height: H,
                    display: 'flex',
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#aadaff',
                    fontFamily: 'sans-serif',
                }}
            >
                {tiles.map((t, i) =>
                    t.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            key={i}
                            src={t.src}
                            width={TILE}
                            height={TILE}
                            style={{ position: 'absolute', left: t.left, top: t.top }}
                            alt=""
                        />
                    ) : null,
                )}

                {/* Pin central */}
                <div
                    style={{
                        position: 'absolute',
                        left: W / 2 - 30,
                        top: H / 2 - 78,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}
                >
                    {n ? (
                        <div
                            style={{
                                display: 'flex',
                                background: '#111827',
                                color: '#fff',
                                padding: '6px 16px',
                                borderRadius: 999,
                                fontSize: 26,
                                fontWeight: 700,
                                marginBottom: 8,
                                maxWidth: 380,
                            }}
                        >
                            {n}
                        </div>
                    ) : null}
                    <div
                        style={{
                            display: 'flex',
                            width: 56,
                            height: 56,
                            borderRadius: '50% 50% 50% 0',
                            transform: 'rotate(-45deg)',
                            background: color,
                            border: '5px solid #fff',
                            boxShadow: '0 5px 14px rgba(0,0,0,.45)',
                        }}
                    />
                </div>

                {/* Banner superior */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '18px 26px',
                        background: 'linear-gradient(rgba(0,0,0,.6), rgba(0,0,0,0))',
                        color: '#fff',
                    }}
                >
                    <div style={{ display: 'flex', fontSize: 34 }}>📍</div>
                    <div style={{ display: 'flex', fontSize: 34, fontWeight: 800 }}>{titulo}</div>
                </div>

                {/* Pie */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 24px',
                        background: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.55))',
                        color: '#fff',
                        fontSize: 19,
                    }}
                >
                    <div style={{ display: 'flex', fontWeight: 700 }}>Festa da Guadalupe · Rianxo</div>
                    <div style={{ display: 'flex', opacity: 0.85 }}>© OpenStreetMap</div>
                </div>
            </div>
        ),
        { width: W, height: H },
    );
}
