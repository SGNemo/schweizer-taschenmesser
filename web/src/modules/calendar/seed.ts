import { addDaysStr, isoWeekday } from '@/core/time/dates';
import type { SeedContext, SeedModule, SeedRow, SeedRows } from '@/core/seed/types';

/** German source text → [en, es, fr, pt-BR]; a text without an entry stays German (places do). */
const TR: Record<string, readonly [string, string, string, string]> = {
  Teammeeting: ['Team meeting', 'Reunión de equipo', 'Réunion d’équipe', 'Reunião de equipe'],
  'Zahnarzt Dr. Beispiel': [
    'Dentist Dr. Beispiel',
    'Dentista Dr. Beispiel',
    'Dentiste Dr Beispiel',
    'Dentista Dr. Beispiel',
  ],
  'Sport: Schwimmen': [
    'Sport: swimming',
    'Deporte: natación',
    'Sport : natation',
    'Esporte: natação',
  ],
  'Elternabend Grundschule': [
    'Parents’ evening at primary school',
    'Reunión de padres del colegio',
    'Réunion de parents à l’école primaire',
    'Reunião de pais da escola',
  ],
  'Geburtstagsfeier Oma': [
    'Grandma’s birthday party',
    'Fiesta de cumpleaños de la abuela',
    'Fête d’anniversaire de Mamie',
    'Festa de aniversário da vovó',
  ],
  'Kuchen mitbringen': ['Bring a cake', 'Llevar una tarta', 'Apporter un gâteau', 'Levar um bolo'],
  'Feiertag-Brückentag': ['Bridge day', 'Puente festivo', 'Pont', 'Dia de ponte'],
  'Wochenendausflug Tegernsee': [
    'Weekend trip to Tegernsee',
    'Escapada de fin de semana a Tegernsee',
    'Week-end à Tegernsee',
    'Passeio de fim de semana em Tegernsee',
  ],
  'Ferienwohnung ist gebucht': [
    'Holiday flat is booked',
    'El apartamento vacacional está reservado',
    'Le meublé de vacances est réservé',
    'O apartamento de temporada está reservado',
  ],
  'Müllabfuhr: Biotonne': [
    'Bin collection: organic waste',
    'Recogida de basura: contenedor orgánico',
    'Ramassage : bac à déchets organiques',
    'Coleta de lixo: orgânico',
  ],
  'Handwerkertermin Heizung': [
    'Heating engineer appointment',
    'Cita con el técnico de la calefacción',
    'Rendez-vous chauffagiste',
    'Visita do técnico do aquecimento',
  ],
  Kinoabend: ['Cinema night', 'Noche de cine', 'Soirée cinéma', 'Noite de cinema'],
  'Miete überweisen': ['Pay the rent', 'Pagar el alquiler', 'Payer le loyer', 'Pagar o aluguel'],
  Lauftreff: ['Running group', 'Grupo de running', 'Groupe de course', 'Grupo de corrida'],
  Arzttermin: ['Doctor’s appointment', 'Cita médica', 'Rendez-vous médical', 'Consulta médica'],
  Friseur: ['Hairdresser', 'Peluquería', 'Coiffeur', 'Cabeleireiro'],
  'Videocall mit Team': [
    'Video call with the team',
    'Videollamada con el equipo',
    'Appel vidéo avec l’équipe',
    'Chamada de vídeo com a equipe',
  ],
  'Mittagessen mit Anna': [
    'Lunch with Anna',
    'Almuerzo con Anna',
    'Déjeuner avec Anna',
    'Almoço com a Anna',
  ],
  'Yoga-Kurs': ['Yoga class', 'Clase de yoga', 'Cours de yoga', 'Aula de ioga'],
  Autowerkstatt: ['Car garage', 'Taller mecánico', 'Garage auto', 'Oficina mecânica'],
  Steuerberatung: ['Tax adviser', 'Asesoría fiscal', 'Conseil fiscal', 'Consultoria fiscal'],
  'Chor-Probe': [
    'Choir rehearsal',
    'Ensayo del coro',
    'Répétition de la chorale',
    'Ensaio do coral',
  ],
  Wochenmarkt: ['Weekly market', 'Mercadillo semanal', 'Marché hebdomadaire', 'Feira semanal'],
  Zahnreinigung: ['Dental cleaning', 'Limpieza dental', 'Détartrage', 'Limpeza dental'],
  Spieleabend: ['Games night', 'Noche de juegos', 'Soirée jeux', 'Noite de jogos'],
  Bibliothek: ['Library', 'Biblioteca', 'Bibliothèque', 'Biblioteca'],
  'Geburtstag Kollege': [
    'Colleague’s birthday',
    'Cumpleaños de un compañero',
    'Anniversaire d’un collègue',
    'Aniversário de um colega',
  ],
  Fahrradcheck: ['Bike check', 'Revisión de la bici', 'Révision du vélo', 'Revisão da bicicleta'],
  Nachbarschaftstreff: [
    'Neighbourhood meet-up',
    'Encuentro vecinal',
    'Rencontre de voisins',
    'Encontro de vizinhos',
  ],
  Konzert: ['Concert', 'Concierto', 'Concert', 'Show'],
  Wandern: ['Hiking', 'Senderismo', 'Randonnée', 'Trilha'],
  Brunch: ['Brunch', 'Brunch', 'Brunch', 'Brunch'],
  'Medikament nehmen': [
    'Take medication',
    'Tomar la medicación',
    'Prendre le médicament',
    'Tomar o remédio',
  ],
  'Paket abholen': [
    'Collect parcel',
    'Recoger el paquete',
    'Récupérer le colis',
    'Buscar a encomenda',
  ],
  'Abholschein liegt im Flur': [
    'Collection slip is in the hallway',
    'El aviso de recogida está en el pasillo',
    'L’avis de passage est dans le couloir',
    'O aviso de retirada está no corredor',
  ],
  'Anna zurückrufen': [
    'Call Anna back',
    'Devolver la llamada a Anna',
    'Rappeler Anna',
    'Retornar a ligação da Anna',
  ],
  'Pflanzen gießen': [
    'Water the plants',
    'Regar las plantas',
    'Arroser les plantes',
    'Regar as plantas',
  ],
  'Zählerstand ablesen': [
    'Read the meter',
    'Leer el contador',
    'Relever le compteur',
    'Ler o medidor',
  ],
  'Rechnung Stadtwerke prüfen': [
    'Check the utilities bill',
    'Revisar la factura de suministros',
    'Vérifier la facture des services municipaux',
    'Conferir a conta de serviços',
  ],
  'Reifenwechsel buchen': [
    'Book tyre change',
    'Reservar el cambio de neumáticos',
    'Réserver le changement de pneus',
    'Agendar a troca de pneus',
  ],
  'Werkstatt Rotbuche anrufen': [
    'Call Rotbuche garage',
    'Llamar al taller Rotbuche',
    'Appeler le garage Rotbuche',
    'Ligar para a oficina Rotbuche',
  ],
  'Altes Abo kündigen': [
    'Cancel old subscription',
    'Cancelar la suscripción antigua',
    'Résilier l’ancien abonnement',
    'Cancelar a assinatura antiga',
  ],
  'Wäsche aufhängen': [
    'Hang up the laundry',
    'Tender la ropa',
    'Étendre le linge',
    'Estender a roupa',
  ],
  'Müll rausbringen': [
    'Take out the rubbish',
    'Sacar la basura',
    'Sortir les poubelles',
    'Levar o lixo para fora',
  ],
  'Geschenk besorgen': [
    'Get a gift',
    'Comprar un regalo',
    'Trouver un cadeau',
    'Comprar um presente',
  ],
  'Termin bestätigen': [
    'Confirm appointment',
    'Confirmar la cita',
    'Confirmer le rendez-vous',
    'Confirmar o compromisso',
  ],
  'Mama anrufen': ['Call Mum', 'Llamar a mamá', 'Appeler maman', 'Ligar para a mãe'],
  'Bücher zurückgeben': ['Return books', 'Devolver libros', 'Rendre les livres', 'Devolver livros'],
  'Auto tanken': ['Fill up the car', 'Echar gasolina', 'Faire le plein', 'Abastecer o carro'],
  'Backup prüfen': [
    'Check the backup',
    'Comprobar la copia de seguridad',
    'Vérifier la sauvegarde',
    'Conferir o backup',
  ],
  'Blumen kaufen': ['Buy flowers', 'Comprar flores', 'Acheter des fleurs', 'Comprar flores'],
  'Putzplan checken': [
    'Check the cleaning rota',
    'Revisar el plan de limpieza',
    'Vérifier le planning ménage',
    'Conferir a escala de limpeza',
  ],
};
const LANG_INDEX = { en: 0, es: 1, fr: 2, 'pt-BR': 3 } as const;
const tr = (ctx: SeedContext, de: string): string =>
  ctx.lang === 'de' ? de : (TR[de]?.[LANG_INDEX[ctx.lang]] ?? de);

interface Base {
  title: string;
  day: number;
  time?: string;
  end?: string;
  endDay?: number;
  location?: string;
  note?: string;
  recurrence?: Record<string, unknown>;
}

/** Fixed core: this and next week, so the "today & tomorrow" widget and the week view are alive. */
const BASE: Base[] = [
  {
    title: 'Teammeeting',
    day: 0,
    time: '10:00',
    end: '11:00',
    location: 'Büro Isarwerk, Musterstraße 12, 80331 München',
    recurrence: { freq: 'weekly', interval: 1 },
  },
  {
    title: 'Zahnarzt Dr. Beispiel',
    day: 0,
    time: '15:30',
    end: '16:15',
    location: 'Zahnarztpraxis Lindenblick, Gartenweg 4, 80469 München',
  },
  {
    title: 'Sport: Schwimmen',
    day: 1,
    time: '18:30',
    end: '19:30',
    location: 'Hallenbad Nordbad, Badstraße 7, 80807 München',
    recurrence: { freq: 'weekly', interval: 1 },
  },
  {
    title: 'Elternabend Grundschule',
    day: 2,
    time: '19:00',
    end: '20:30',
    location: 'Grundschule Am Eichenhain, Schulstraße 3, 81241 München',
  },
  {
    title: 'Geburtstagsfeier Oma',
    day: 3,
    time: '14:00',
    end: '18:00',
    location: 'Gasthof Zur Linde, Dorfplatz 1, 85221 Dachau',
    note: 'Kuchen mitbringen',
  },
  { title: 'Feiertag-Brückentag', day: 4, endDay: 4 },
  { title: 'Wochenendausflug Tegernsee', day: 5, endDay: 6, note: 'Ferienwohnung ist gebucht' },
  { title: 'Müllabfuhr: Biotonne', day: 1, recurrence: { freq: 'weekly', interval: 2 } },
  {
    title: 'Handwerkertermin Heizung',
    day: 7,
    time: '08:00',
    end: '10:00',
    location: 'Haustechnik Sonnenberg GmbH, Werkstraße 22, 80992 München',
  },
  {
    title: 'Kinoabend',
    day: 8,
    time: '20:15',
    end: '22:30',
    location: 'Kino Lichtspielhaus, Filmgasse 9, 80333 München',
  },
  {
    title: 'Miete überweisen',
    day: 12,
    recurrence: { freq: 'monthly', interval: 1, byMonthDay: 1 },
  },
  {
    title: 'Lauftreff',
    day: -2,
    time: '07:00',
    end: '08:00',
    location: 'Westpark, Eingang Parkallee, 81373 München',
    recurrence: { freq: 'weekly', interval: 1 },
  },
];

const FILLER_TITLES = [
  'Arzttermin',
  'Friseur',
  'Videocall mit Team',
  'Mittagessen mit Anna',
  'Yoga-Kurs',
  'Autowerkstatt',
  'Steuerberatung',
  'Chor-Probe',
  'Wochenmarkt',
  'Zahnreinigung',
  'Spieleabend',
  'Bibliothek',
  'Geburtstag Kollege',
  'Fahrradcheck',
  'Nachbarschaftstreff',
  'Konzert',
  'Wandern',
  'Brunch',
];
const FILLER_PLACES = [
  'Café Morgenrot, Hauptstraße 18, 80331 München',
  'Praxis am Markt, Marktplatz 5, 80333 München',
  'Sportzentrum Südpark, Parkweg 2, 81379 München',
  'Gemeindehaus St. Michael, Kirchgasse 6, 82049 Pullach',
  'Autohaus Rotbuche, Industrieweg 31, 85748 Garching',
  'Stadtbibliothek Mitte, Leseplatz 1, 80335 München',
];
const TIMES = ['08:00', '09:30', '11:00', '13:00', '16:00', '17:30', '19:00'];

function toRow(ctx: SeedContext, key: number, b: Base): SeedRow {
  const data: Record<string, unknown> = {
    title: tr(ctx, b.title),
    allDay: !b.time,
    startDate: ctx.day(b.day),
  };
  if (b.time) data.startTime = b.time;
  if (b.end) data.endTime = b.end;
  if (b.endDay !== undefined && b.endDay > b.day) data.endDate = ctx.day(b.endDay);
  if (b.location) data.location = b.location;
  if (b.note) data.note = tr(ctx, b.note);
  if (b.recurrence) data.recurrence = b.recurrence;
  return { id: ctx.id('calendar', 'event', key), data };
}

interface ReminderBase {
  title: string;
  day: number;
  time: string;
  note?: string;
  recurrence?: Record<string, unknown>;
  active?: boolean;
}

const REMINDERS: ReminderBase[] = [
  {
    title: 'Medikament nehmen',
    day: -10,
    time: '08:00',
    recurrence: { freq: 'daily', interval: 1 },
  },
  { title: 'Paket abholen', day: 0, time: '17:30', note: 'Abholschein liegt im Flur' },
  { title: 'Anna zurückrufen', day: 1, time: '12:15' },
  {
    title: 'Pflanzen gießen',
    day: -14,
    time: '19:00',
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [3, 7] },
  },
  {
    title: 'Zählerstand ablesen',
    day: -3,
    time: '09:00',
    recurrence: { freq: 'monthly', interval: 1, byMonthDay: 1 },
  },
  { title: 'Rechnung Stadtwerke prüfen', day: 3, time: '10:00' },
  { title: 'Reifenwechsel buchen', day: 6, time: '09:30', note: 'Werkstatt Rotbuche anrufen' },
  { title: 'Altes Abo kündigen', day: -20, time: '09:00', active: false },
];
const REMINDER_FILLER = [
  'Wäsche aufhängen',
  'Müll rausbringen',
  'Geschenk besorgen',
  'Termin bestätigen',
  'Mama anrufen',
  'Bücher zurückgeben',
  'Auto tanken',
  'Backup prüfen',
  'Blumen kaufen',
  'Putzplan checken',
];
const REMINDER_TIMES = ['07:30', '09:00', '12:00', '14:30', '18:00', '20:00'];

/** Reminders are events of the kind "reminder" (since 0.7.0). */
function reminderRows(ctx: SeedContext) {
  const total = ctx.count({ small: 6, medium: 24, large: 250 });
  const list: ReminderBase[] = REMINDERS.slice(0, Math.min(total, REMINDERS.length));
  if (ctx.scale === 'small') list[5] = REMINDERS[7]!;
  for (let i = list.length; i < total; i++) {
    const recurring = ctx.rng.chance(0.3);
    list.push({
      title: ctx.rng.pick(REMINDER_FILLER),
      day: recurring ? ctx.rng.int(-30, 0) : ctx.rng.int(-5, 30),
      time: ctx.rng.pick(REMINDER_TIMES),
      recurrence: recurring
        ? ctx.rng.pick([
            { freq: 'daily', interval: 1 },
            { freq: 'weekly', interval: 1 },
            { freq: 'monthly', interval: 1 },
          ])
        : undefined,
      active: ctx.rng.chance(0.9),
    });
  }
  return list.map((b, i) => {
    const data: Record<string, unknown> = {
      title: tr(ctx, b.title),
      kind: 'reminder',
      allDay: false,
      startDate: ctx.day(b.day),
      startTime: b.time,
      notify: { minutesBefore: 0, enabled: b.active ?? true },
    };
    if (b.note) data.note = tr(ctx, b.note);
    if (b.recurrence) data.recurrence = b.recurrence;
    return { id: ctx.id('calendar', 'reminder', i), data };
  });
}

function seed(ctx: SeedContext): SeedRows {
  const total = ctx.count({ small: 10, medium: 45, large: 300 });
  const base = ctx.scale === 'small' ? BASE.slice(0, total) : BASE;
  const rows = base.map((b, i) => toRow(ctx, i, b));
  for (let i = base.length; i < total; i++) {
    const day = ctx.rng.int(-20, 40);
    const timed = ctx.rng.chance(0.75);
    const time = ctx.rng.pick(TIMES);
    const startH = Number(time.slice(0, 2));
    const end = `${String(Math.min(startH + ctx.rng.int(1, 2), 23)).padStart(2, '0')}:${time.slice(3)}`;
    const place = ctx.rng.chance(0.6) ? ctx.rng.pick(FILLER_PLACES) : undefined;
    const b: Base = { title: ctx.rng.pick(FILLER_TITLES), day };
    if (timed) {
      b.time = time;
      b.end = end;
    } else if (ctx.rng.chance(0.2)) {
      b.endDay = day + ctx.rng.int(1, 3);
    }
    if (place) b.location = place;
    if (ctx.rng.chance(0.12)) {
      // Weekday-anchored weekly series starting on that very weekday.
      b.recurrence = {
        freq: 'weekly',
        interval: 1,
        byWeekday: [isoWeekday(addDaysStr(ctx.today, day))],
      };
    }
    rows.push(toRow(ctx, i, b));
  }
  return { event: [...rows, ...reminderRows(ctx)] };
}

export default { seed } satisfies SeedModule;
