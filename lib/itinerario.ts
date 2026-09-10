// Itinerario da Festa da Guadalupe (Rianxo) por días e horas.
// Contido do PROGRAMA OFICIAL 2026 (PDF da organización, 11-18 de setembro).
// Xa non é provisional: as horas e os grupos son os do cartel.

export interface ItinerarioEvento {
    hora: string;   // "HH:MM" (24h)
    titulo: string;
    grupo?: string; // artista/orquestra (texto rosa no cartel)
    lugar?: string; // sitio concreto, sae cun chincheta (e algún día no mapa)
    /** Letra pequena do cartel: organiza, colabora, patrocina, cortesía de… */
    nota?: string;
    icono?: string; // emoji
}

export interface ItinerarioDia {
    fecha: string;   // "YYYY-MM-DD"
    etiqueta: string;
    eventos: ItinerarioEvento[];
}

export const ITINERARIO_PROVISIONAL = false;

export const ITINERARIO: ItinerarioDia[] = [
    {
        fecha: '2026-09-11',
        etiqueta: 'Venres',
        eventos: [
            { hora: '22:00', titulo: 'Noite Retro', grupo: 'Virtual Project Cover Band', icono: '🎸' },
            { hora: '23:45', titulo: 'Pregón das Festas', nota: 'Organiza o Concello de Rianxo', icono: '📣' },
            { hora: '00:00', titulo: 'Chupitaso · Presentación musical das Juadalupeñas', icono: '🥳' },
            { hora: '00:30', titulo: 'VídeoDJ 80s, 90s, 2000s…', grupo: 'Serieb Music', icono: '🎧' },
            { hora: '04:00', titulo: 'Pinchada libre', grupo: 'Xinho', icono: '🎧' },
        ],
    },
    {
        fecha: '2026-09-12',
        etiqueta: 'Sábado',
        eventos: [
            { hora: '10:00', titulo: 'Alborada', grupo: 'Banda de Música de Santa Cruz de Ribadulla', icono: '🎺' },
            { hora: '10:00', titulo: 'Alborada pola parroquia', grupo: 'Trécola', icono: '🎺' },
            { hora: '13:00', titulo: 'Concerto', grupo: 'Banda de Música de Santa Cruz de Ribadulla', lugar: 'Praza da Igrexa', icono: '🎺' },
            { hora: '14:00', titulo: 'Sesión vermú coa orquestra', grupo: 'Platinum', icono: '🍻' },
            { hora: '18:00', titulo: 'Concerto', grupo: 'Banda de Música de Santa Cruz de Ribadulla', lugar: 'Praza da Igrexa', nota: 'Programa ALICERCE da Rede Cultural da Deputación da Coruña', icono: '🎺' },
            { hora: '19:00', titulo: 'Tardeo', grupo: 'Zeltia Irevire', lugar: 'Rúa do Medio', nota: 'Colabora O Recuncho Café', icono: '🍹' },
            { hora: '19:30', titulo: 'Novena e ofrendas', lugar: 'Capela de Guadalupe', icono: '⛪' },
            { hora: '20:00', titulo: 'Baile e música tradicionais', grupo: 'Fogo Fatuo', lugar: 'Praza da Igrexa', icono: '💃' },
            { hora: '20:00', titulo: 'Certame de Corais', grupo: 'Coral Abraira (Asados) + corais convidadas', lugar: 'Auditorio', nota: 'Patrocina o Concello de Rianxo', icono: '🎵' },
            { hora: '20:00', titulo: 'Charanga polas rúas da vila', grupo: 'Brass-Ass', icono: '🎺' },
            { hora: '21:30', titulo: 'Sábado noite', grupo: 'Mariachi Perla', icono: '🎺' },
            { hora: '22:30', titulo: 'Orquestra', grupo: 'Platinum', icono: '🎶' },
            { hora: '23:30', titulo: 'Verbena Sinfónica', grupo: 'Banda da Escola de Música de Rianxo', nota: 'Patrocina o Concello de Rianxo', icono: '🎶' },
            { hora: '02:00', titulo: 'Verbena', grupo: 'Capitán Sabrosura', icono: '🎶' },
            { hora: '04:00', titulo: 'Pinchada', grupo: 'DJ Nexxa', icono: '🎧' },
        ],
    },
    {
        fecha: '2026-09-13',
        etiqueta: 'Domingo',
        eventos: [
            { hora: '10:00', titulo: 'Alborada', grupo: 'Agrupación músico cultural de Ribadumia · Banda de Gaitas Buxaina de Taragoña', icono: '🎺' },
            { hora: '12:00', titulo: 'Misa Solemne', grupo: 'Coral Abraira', lugar: 'Capela de Guadalupe', icono: '⛪' },
            { hora: '13:00', titulo: 'Tradicional Procesión Marítima', lugar: 'Paseo da Ribeira', nota: 'Colaboran a Confraría e as asociacións mexilloeiras', icono: '⛪' },
            { hora: '18:00', titulo: 'Concerto', grupo: 'Agrupación músico cultural de Ribadumia', lugar: 'Praza da Igrexa', icono: '🎺' },
            { hora: '19:00', titulo: 'Baile-Romaría', grupo: 'Grupo Arena', lugar: 'Paseo da Ribeira', icono: '💃' },
            { hora: '20:00', titulo: 'Baile e música tradicionais', grupo: 'Vai de Roda', lugar: 'Praza da Igrexa', icono: '💃' },
            { hora: '22:00', titulo: 'Verbena', grupo: 'Galilea · La Banda de Ayer', icono: '🎶' },
            { hora: '00:00', titulo: 'Fogos de artificio aéreos e acuáticos', lugar: 'Paseo da Ribeira', icono: '🎆' },
        ],
    },
    {
        fecha: '2026-09-14',
        etiqueta: 'Luns',
        eventos: [
            { hora: '10:00', titulo: 'Alborada', grupo: 'Banda de Música Cultural de Arcade', icono: '🎺' },
            { hora: '11:00', titulo: 'Visita da Virxe de Guadalupe á Igrexa Parroquial', icono: '⛪' },
            { hora: '11:30', titulo: 'Xogos das Juadalupeñas', lugar: 'Praza Castelao', nota: 'Organiza a Comisión de Juadalupeñas', icono: '🎪' },
            { hora: '13:00', titulo: 'Concerto', grupo: 'Banda de Música Cultural de Arcade', lugar: 'Praza da Igrexa', icono: '🎺' },
            { hora: '14:00', titulo: 'Sesión vermú', grupo: 'Unión y Fuerza', icono: '🍻' },
            { hora: '18:00', titulo: 'Festivaliño', nota: 'Organiza a Comisión de Juadalupeñas', icono: '🎪' },
            { hora: '18:00', titulo: 'Concerto', grupo: 'Banda de Música Cultural de Arcade', lugar: 'Praza da Igrexa', icono: '🎺' },
            { hora: '20:00', titulo: 'Cantos populares', grupo: 'Cántañe a Rianxo con Río de Anxo', lugar: 'Praza da Igrexa', icono: '🎵' },
            { hora: '22:00', titulo: 'Verbena', grupo: 'Unión y Fuerza · Cayenna', icono: '🎶' },
        ],
    },
    {
        fecha: '2026-09-15',
        etiqueta: 'Martes',
        eventos: [
            { hora: '11:00', titulo: 'Da alborada ao vermú polas rúas cos gaiteiros', grupo: 'O Son do Río', icono: '🎺' },
            { hora: '12:00', titulo: 'Cultura Urbana: Soccer Experience', grupo: 'Vella Escola Cultura Urbana', lugar: 'Paseo da Ribeira', icono: '⚽' },
            { hora: '14:00', titulo: 'Sesión vermú', grupo: 'Dilema', lugar: 'Praza Castelao', icono: '🍻' },
            { hora: '16:00', titulo: 'Cultura Urbana: VR Arena', grupo: 'Vella Escola Cultura Urbana', lugar: 'Paseo da Ribeira', icono: '🎮' },
            { hora: '18:30', titulo: 'Día de Padrón · Recepción ás autoridades de Padrón', grupo: 'Banda da Escola de Música de Rianxo', nota: 'Organiza o Concello de Rianxo', icono: '🤝' },
            { hora: '19:30', titulo: 'Concerto', grupo: 'Banda de Música Municipal de Padrón', lugar: 'Campo de Arriba', nota: 'Cortesía do Concello de Padrón', icono: '🎺' },
            { hora: '20:00', titulo: 'Charanga polas rúas da vila', grupo: 'Fanfarria Furruxa', icono: '🎺' },
            { hora: '20:00', titulo: 'Obradoiro freestyle e concertos de RAP en galego', grupo: 'Ceibarimas · Kid Mount · Festra · Mooom · Pini · O Rabelo · Volk GZ · Queen Rendi · O netinho da Aurora', lugar: 'Praza da Igrexa', nota: 'Con Merenda Creativa', icono: '🎤' },
            { hora: '22:00', titulo: 'Verbena', grupo: 'Charleston Big Band · La Última Legión', icono: '🎶' },
        ],
    },
    {
        fecha: '2026-09-16',
        etiqueta: 'Mércores',
        eventos: [
            { hora: '11:00', titulo: 'Da alborada ao vermú polas rúas cos gaiteiros', grupo: 'Os Festas', icono: '🎺' },
            { hora: '12:00', titulo: 'Feira do Circo · Xogos de feira todo o día', lugar: 'Praza da Igrexa', icono: '🎪' },
            { hora: '13:00', titulo: 'O Show de Fifo: Soño', icono: '🤡' },
            { hora: '14:00', titulo: 'Sesión vermú', grupo: 'Solara', lugar: 'Praza Castelao', icono: '🍻' },
            { hora: '15:00', titulo: 'Xantar dos nosos maiores', grupo: 'Baile con José Manuel Domínguez', nota: 'Organiza o Concello de Rianxo', icono: '🍽️' },
            { hora: '16:00', titulo: 'Feira do Circo', lugar: 'Praza da Igrexa', icono: '🎪' },
            { hora: '18:00', titulo: 'Concerto', grupo: 'Banda de Música de Arca', lugar: 'Campo de Arriba', nota: 'Por cortesía da Escola de Música de Rianxo · Programa ALICERCE da Deputación da Coruña', icono: '🎺' },
            { hora: '19:00', titulo: 'Tardeo', grupo: 'Malezza', lugar: 'Rúa de Abaixo', nota: 'Colabora o Restaurante O Vilar', icono: '🍹' },
            { hora: '19:30', titulo: 'Bailes de salón', grupo: 'El Tomasón', lugar: 'Campo de Arriba', icono: '💃' },
            { hora: '20:00', titulo: 'Circo na rúa: Unha de Piratas', lugar: 'Praza da Igrexa', icono: '🎪' },
            { hora: '20:00', titulo: 'Charanga polas rúas da vila', grupo: 'Bando das Gaitas (Portugal)', icono: '🎺' },
            { hora: '22:00', titulo: 'Verbena', grupo: 'Solara · Cinema', icono: '🎶' },
        ],
    },
    {
        fecha: '2026-09-17',
        etiqueta: 'Xoves',
        eventos: [
            { hora: '11:00', titulo: 'Feirón Mariñeiro «A feira de 1926» · artesanía todo o día', lugar: 'Casco vello da vila', nota: 'Colaboran as asociacións culturais locais e a veciñanza de Rianxo', icono: '⚓' },
            { hora: '13:00', titulo: 'Sesión vermú', grupo: 'Cé Orquestra Pantasma', lugar: 'Praza da Igrexa', icono: '🍻' },
            { hora: '14:00', titulo: 'Sesión vermú', grupo: 'Trío Alborada', lugar: 'Praza Castelao', icono: '🍻' },
            { hora: '20:00', titulo: 'Paxaro Pinto', lugar: 'Xardíns da Ribeira', icono: '🎵' },
            { hora: '21:00', titulo: 'Noite Folc', grupo: 'Mediarea · Boavila', icono: '🪗' },
            { hora: '22:00', titulo: 'Verbena', grupo: 'Arizona · Gran Parada', icono: '🎶' },
        ],
    },
    {
        fecha: '2026-09-18',
        etiqueta: 'Venres',
        eventos: [
            { hora: '11:00', titulo: 'Día Infantil · Inchables acuáticos todo o día', lugar: 'Praza Virxe de Guadalupe', icono: '🎈' },
            { hora: '13:00', titulo: 'Festa da escuma', lugar: 'Praza Castelao', icono: '🫧' },
            { hora: '14:00', titulo: 'Sesión vermú', grupo: 'Eureka', icono: '🍻' },
            { hora: '16:00', titulo: 'Inchables', lugar: 'Praza Virxe de Guadalupe', icono: '🎈' },
            { hora: '22:30', titulo: 'Gran Verbena', grupo: 'Eureka · Trébol · Ritmo Xoven', icono: '🎶' },
            { hora: '23:00', titulo: 'Verbena infantil · Rock infantil', grupo: 'Pakolas e as Tripulantes', lugar: 'Praza da Igrexa', icono: '🎸' },
            { hora: '00:00', titulo: 'Rianxeira infantil', icono: '🎶' },
            { hora: '02:00', titulo: 'Gran traca final', grupo: 'Bengalas e Rianxeira', icono: '🎆' },
        ],
    },
];
