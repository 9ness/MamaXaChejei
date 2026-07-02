// Itinerario da Festa da Guadalupe (Rianxo) por días e horas.
// Contido baseado no cartel 2025 (festasdaguadalupe.gal). As datas 2026 son
// PROVISIONAIS: mantéñense os mesmos días da semana (Venres→Venres), pero en
// 2026 o primeiro venres cae o 11 de setembro. Actualízanse co cartel oficial.

export interface ItinerarioEvento {
    hora: string;   // "HH:MM" (24h)
    titulo: string;
    grupo?: string; // artista/orquestra (texto rosa no cartel)
    lugar?: string;
    icono?: string; // emoji
}

export interface ItinerarioDia {
    fecha: string;   // "YYYY-MM-DD" (2026, provisional)
    etiqueta: string;
    eventos: ItinerarioEvento[];
}

export const ITINERARIO_PROVISIONAL = true;

export const ITINERARIO: ItinerarioDia[] = [
    {
        fecha: '2026-09-11',
        etiqueta: 'Venres',
        eventos: [
            { hora: '22:00', titulo: 'Festa dos 90', grupo: 'The Cuncas', lugar: 'Praza Castelao', icono: '🎧' },
            { hora: '00:00', titulo: 'Chupitaso · Presentación das Juadalupeñas', icono: '🥳' },
            { hora: '01:00', titulo: 'VídeoDJ dos 90', grupo: 'Serieb Music', icono: '🎧' },
            { hora: '03:00', titulo: 'Pinchada libre', grupo: 'DJ Ekix', icono: '🎧' },
        ],
    },
    {
        fecha: '2026-09-12',
        etiqueta: 'Sábado',
        eventos: [
            { hora: '10:00', titulo: 'Alborada', grupo: 'Banda da Escola de Música de Rianxo', icono: '🎺' },
            { hora: '10:00', titulo: 'Alborada pola parroquia', grupo: 'Trécola', icono: '🎺' },
            { hora: '10:00', titulo: 'Ruta Cicloturista (saída ás 11)', lugar: 'Praza Castelao', icono: '🚴' },
            { hora: '13:00', titulo: 'Concerto', grupo: 'Banda da Escola de Música de Rianxo', lugar: 'Praza da Igrexa', icono: '🎺' },
            { hora: '14:00', titulo: 'Sesión vermú coa orquestra', grupo: 'Channel', icono: '🍻' },
            { hora: '18:00', titulo: 'Concerto', grupo: 'Banda Xuvenil da Escola de Música de Rianxo', lugar: 'Praza da Igrexa', icono: '🎺' },
            { hora: '19:00', titulo: 'Tardeo', grupo: 'Naitinain', lugar: 'Rúa de Abaixo', icono: '🍹' },
            { hora: '20:00', titulo: 'Baile e música tradicionais', grupo: 'Fogo Fatuo', lugar: 'Praza da Igrexa', icono: '💃' },
            { hora: '20:00', titulo: 'Novena e Ofrenda', lugar: 'Capela de Guadalupe', icono: '⛪' },
            { hora: '20:00', titulo: 'Certame de Corais', grupo: 'Coral Abraira + convidadas', lugar: 'Auditorio', icono: '🎵' },
            { hora: '20:00', titulo: 'Charanga polas rúas', grupo: 'Os Celtas', icono: '🎺' },
            { hora: '21:30', titulo: 'Verbena Galega', grupo: 'Orquestra Channel · Pili Pampín · Mekanika Rolling Band · Coolnenas · Galician Army', icono: '🎶' },
        ],
    },
    {
        fecha: '2026-09-13',
        etiqueta: 'Domingo',
        eventos: [
            { hora: '10:00', titulo: 'Alborada', grupo: 'Banda de Música de Catoira · Banda de Gaitas Buxaina de Taragoña', icono: '🎺' },
            { hora: '11:00', titulo: 'Recepción á veciñanza de Requejo de Sanabria e Os Prados–Xesta', icono: '🤝' },
            { hora: '11:00', titulo: 'Rondalla polas rúas', grupo: 'Mariachi Perla', icono: '🎻' },
            { hora: '12:00', titulo: 'Misa Solemne + Las Mañanitas', grupo: 'Coral Abraira · Mariachi Perla', lugar: 'Capela de Guadalupe', icono: '⛪' },
            { hora: '13:00', titulo: 'Procesión Marítima', lugar: 'Ribeira', icono: '⛪' },
            { hora: '18:00', titulo: 'Concerto', grupo: 'Banda de Música de Catoira', lugar: 'Praza da Igrexa', icono: '🎺' },
            { hora: '19:00', titulo: 'Tardeo', grupo: 'Sós', lugar: 'A Martela', icono: '🍹' },
            { hora: '19:00', titulo: 'Baile-Romaría', grupo: 'Trío Alborada', lugar: 'Paseo da Ribeira', icono: '💃' },
            { hora: '20:00', titulo: 'Baile e música tradicionais', grupo: 'Vai de Roda', lugar: 'Praza da Igrexa', icono: '💃' },
            { hora: '22:00', titulo: 'Verbena', grupo: 'Grupo Beatriz · Arizona', icono: '🎶' },
            { hora: '00:00', titulo: 'Fogos de artificio aéreos e acuáticos', lugar: 'Paseo da Ribeira', icono: '🎆' },
        ],
    },
    {
        fecha: '2026-09-14',
        etiqueta: 'Luns',
        eventos: [
            { hora: '10:00', titulo: 'Alborada', grupo: 'Banda Cultural de Arcade', icono: '🎺' },
            { hora: '11:00', titulo: 'Visita da Virxe de Guadalupe á Igrexa Parroquial', icono: '⛪' },
            { hora: '11:30', titulo: 'Xogos das peñas (Juadalupeñas)', lugar: 'Praza Castelao', icono: '🎉' },
            { hora: '13:00', titulo: 'Concerto', grupo: 'Banda Cultural de Arcade', lugar: 'Praza da Igrexa', icono: '🎺' },
            { hora: '14:00', titulo: 'Sesión vermú', grupo: 'Unión y Fuerza', icono: '🍻' },
            { hora: '15:00', titulo: 'Xantar popular das Juadalupeñas', lugar: 'Parque da Martela', icono: '🍽️' },
            { hora: '18:00', titulo: 'Festivaliño', lugar: 'Rock in Rian', icono: '🎸' },
            { hora: '18:00', titulo: 'Concerto', grupo: 'Banda Cultural de Arcade', lugar: 'Praza da Igrexa', icono: '🎺' },
            { hora: '20:00', titulo: 'Cantos populares', grupo: 'Cántañe a Rianxo con Río de Anxo', lugar: 'Praza da Igrexa', icono: '🎵' },
            { hora: '22:00', titulo: 'Verbena', grupo: 'Unión y Fuerza · Gran Parada', icono: '🎶' },
        ],
    },
    {
        fecha: '2026-09-15',
        etiqueta: 'Martes',
        eventos: [
            { hora: '11:00', titulo: 'Da alborada ao vermú polas rúas', grupo: 'O Son do Río', icono: '🎺' },
            { hora: '11:30', titulo: 'Cultura Urbana: ParkourPark, WorkoutPark e Muralismo', lugar: 'Praza da Igrexa e Xardíns da Ribeira', icono: '🛹' },
            { hora: '14:00', titulo: 'Sesión vermú', grupo: 'Dilema', lugar: 'Praza Castelao', icono: '🍻' },
            { hora: '17:00', titulo: 'Continuación de Cultura Urbana', icono: '🛹' },
            { hora: '18:30', titulo: 'Día de Padrón: recepción e concerto', grupo: 'Banda Municipal de Padrón', lugar: 'Campo de Arriba', icono: '🎺' },
            { hora: '20:00', titulo: 'Charanga polas rúas', grupo: 'Charandonga', icono: '🎺' },
            { hora: '20:00', titulo: 'Freestyle e RAP en galego', grupo: 'Ceibarimas: O Pirata · Big Meu · NubeNegra · Jallejo · XianPais · Mog · Carola', lugar: 'Praza da Igrexa', icono: '🎤' },
            { hora: '22:00', titulo: 'Verbena', grupo: 'Cougar · Marbella', icono: '🎶' },
        ],
    },
    {
        fecha: '2026-09-16',
        etiqueta: 'Mércores',
        eventos: [
            { hora: '11:00', titulo: 'Da alborada ao vermú polas rúas', grupo: 'Os Festas', icono: '🎺' },
            { hora: '13:00', titulo: 'Circo na rúa', grupo: 'Asacocirco Show', lugar: 'Praza da Igrexa', icono: '🎪' },
            { hora: '14:00', titulo: 'Sesión vermú', grupo: 'Trío Alborada', lugar: 'Praza Castelao', icono: '🍻' },
            { hora: '15:00', titulo: 'Día dos Nosos Maiores: Xantar e Baile', grupo: 'José Manuel Domínguez', icono: '🍽️' },
            { hora: '18:00', titulo: 'Concerto', grupo: 'Banda de Música de Visantoña', lugar: 'Praza da Igrexa', icono: '🎺' },
            { hora: '19:00', titulo: 'Tardeo', grupo: 'Ulex', lugar: 'Rúa do Medio', icono: '🍹' },
            { hora: '20:00', titulo: 'Circo na rúa', grupo: 'O Rei Midas', lugar: 'Praza da Igrexa', icono: '🎪' },
            { hora: '20:00', titulo: 'Charanga polas rúas', grupo: 'Charanga Furruxa', icono: '🎺' },
            { hora: '22:00', titulo: 'Verbena', grupo: 'Cayenna · Satélites', icono: '🎶' },
        ],
    },
    {
        fecha: '2026-09-17',
        etiqueta: 'Xoves',
        eventos: [
            { hora: '10:00', titulo: 'Feirón Mariñeiro «A feira de 1925»', lugar: 'Casco vello (todo o día)', icono: '🛍️' },
            { hora: '13:00', titulo: 'Sesión vermú', grupo: 'Cé Orquestra Pantasma', lugar: 'Praza da Igrexa', icono: '🍻' },
            { hora: '14:00', titulo: 'Sesión vermú', grupo: 'Grupo Alaska', lugar: 'Praza Castelao', icono: '🍻' },
            { hora: '20:00', titulo: 'Rianxeira Popular', lugar: 'Xardíns da Ribeira', icono: '🎵' },
            { hora: '21:00', titulo: 'Noite Folc', grupo: 'Benofán · Alvariza · Maruxa e Coralia Dilleis', lugar: 'Xardíns da Ribeira', icono: '🎻' },
            { hora: '22:00', titulo: 'Verbena', grupo: 'Banda Gaudí · New York', icono: '🎶' },
        ],
    },
    {
        fecha: '2026-09-18',
        etiqueta: 'Venres',
        eventos: [
            { hora: '11:00', titulo: 'Día Infantil: Gran Xincana Inchable', lugar: 'Praza Virxe de Guadalupe', icono: '🎈' },
            { hora: '13:00', titulo: 'Festa da Escuma', lugar: 'Praza Castelao', icono: '🫧' },
            { hora: '14:00', titulo: 'Sesión vermú', grupo: 'Mar de Arousa', icono: '🍻' },
            { hora: '16:00', titulo: 'Gran Xincana Inchable', icono: '🎈' },
            { hora: '23:00', titulo: 'Verbena Infantil', grupo: 'Uxía Lambona e a Banda Molona', lugar: 'Praza da Igrexa', icono: '🧒' },
            { hora: '00:00', titulo: 'Rianxeira Infantil', icono: '🎵' },
            { hora: '00:30', titulo: 'Gran Verbena (3 orquestras)', grupo: 'Mar de Arousa · Ritmo Xoven · Saudade', icono: '🎶' },
            { hora: '02:00', titulo: 'Gran traca final: bengalas e Rianxeira', icono: '🎆' },
        ],
    },
];
