// Itinerario de la fiesta por días y horas.
// ⚠️ Estos datos son un EJEMPLO provisional hasta tener el cartel oficial.
// Cuando llegue el cartel, se sustituyen (o se pasan a editable desde Gestión).

export interface ItinerarioEvento {
    hora: string;   // "HH:MM" (24h)
    titulo: string;
    lugar?: string;
    icono?: string; // emoji
}

export interface ItinerarioDia {
    fecha: string;   // "YYYY-MM-DD"
    etiqueta: string;
    eventos: ItinerarioEvento[];
}

export const ITINERARIO_ES_EJEMPLO = true;

export const ITINERARIO: ItinerarioDia[] = [
    {
        fecha: '2026-09-11',
        etiqueta: 'Venres',
        eventos: [
            { hora: '20:00', titulo: 'Apertura do recinto', lugar: 'Campo da festa', icono: '🎪' },
            { hora: '22:00', titulo: 'Verbena', lugar: 'Escenario principal', icono: '🎶' },
            { hora: '01:00', titulo: 'Sesión vermú (DJ)', lugar: 'Carpa', icono: '🍸' },
        ],
    },
    {
        fecha: '2026-09-12',
        etiqueta: 'Sábado',
        eventos: [
            { hora: '12:00', titulo: 'Sesión vermú', lugar: 'Campo da festa', icono: '🍻' },
            { hora: '14:30', titulo: 'Comida da peña', lugar: 'Carpa', icono: '🍽️' },
            { hora: '18:00', titulo: 'Charanga', lugar: 'Rúas do pobo', icono: '🎺' },
            { hora: '23:00', titulo: 'Orquestra', lugar: 'Escenario principal', icono: '🎤' },
        ],
    },
    {
        fecha: '2026-09-13',
        etiqueta: 'Domingo',
        eventos: [
            { hora: '13:00', titulo: 'Misa e procesión', lugar: 'Igrexa', icono: '⛪' },
            { hora: '14:30', titulo: 'Xantar popular', lugar: 'Campo da festa', icono: '🥘' },
            { hora: '20:00', titulo: 'Foguetes de despedida', lugar: 'Campo da festa', icono: '🎆' },
        ],
    },
];
