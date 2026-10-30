import type { SeedContext, SeedModule, SeedRow, SeedRows } from '@/core/seed/types';

/** German source text → [en, es, fr, pt-BR]; a text without an entry stays German. */
const TR: Record<string, readonly [string, string, string, string]> = {
  Haushalt: ['Household', 'Hogar', 'Maison', 'Casa'],
  Arbeit: ['Work', 'Trabajo', 'Travail', 'Trabalho'],
  'Einkäufe & Besorgungen': [
    'Shopping & errands',
    'Compras y recados',
    'Courses et démarches',
    'Compras e tarefas',
  ],
  'Projekt Balkon': ['Balcony project', 'Proyecto balcón', 'Projet balcon', 'Projeto varanda'],
  'Steuererklärung vorbereiten': [
    'Prepare tax return',
    'Preparar la declaración de la renta',
    'Préparer la déclaration d’impôts',
    'Preparar a declaração de imposto',
  ],
  'Belege sortieren': [
    'Sort receipts',
    'Ordenar justificantes',
    'Trier les justificatifs',
    'Organizar os comprovantes',
  ],
  'Formular ausfüllen': [
    'Fill in the form',
    'Rellenar el formulario',
    'Remplir le formulaire',
    'Preencher o formulário',
  ],
  Abgeben: ['Hand it in', 'Entregar', 'Rendre le dossier', 'Entregar'],
  'Fenster putzen': [
    'Clean the windows',
    'Limpiar las ventanas',
    'Nettoyer les fenêtres',
    'Limpar as janelas',
  ],
  'Glühbirne im Flur wechseln': [
    'Change the bulb in the hallway',
    'Cambiar la bombilla del pasillo',
    'Changer l’ampoule du couloir',
    'Trocar a lâmpada do corredor',
  ],
  'Keller aufräumen': ['Tidy the cellar', 'Ordenar el sótano', 'Ranger la cave', 'Arrumar o porão'],
  'Altes Regal entsorgen': [
    'Dispose of the old shelf',
    'Tirar la estantería vieja',
    'Jeter l’ancienne étagère',
    'Descartar a estante velha',
  ],
  'Waschmaschine entkalken': [
    'Descale the washing machine',
    'Descalcificar la lavadora',
    'Détartrer la machine à laver',
    'Descalcificar a máquina de lavar',
  ],
  'Quartalsbericht schreiben': [
    'Write the quarterly report',
    'Escribir el informe trimestral',
    'Rédiger le rapport trimestriel',
    'Escrever o relatório trimestral',
  ],
  'Zahlen einholen': [
    'Collect the figures',
    'Reunir las cifras',
    'Rassembler les chiffres',
    'Reunir os números',
  ],
  'Entwurf an Team': [
    'Send draft to the team',
    'Enviar el borrador al equipo',
    'Envoyer le brouillon à l’équipe',
    'Enviar o rascunho à equipe',
  ],
  'Urlaubsantrag einreichen': [
    'Submit leave request',
    'Presentar la solicitud de vacaciones',
    'Déposer la demande de congés',
    'Enviar o pedido de férias',
  ],
  'Präsentation proben': [
    'Rehearse the presentation',
    'Ensayar la presentación',
    'Répéter la présentation',
    'Ensaiar a apresentação',
  ],
  'Reisekosten abrechnen': [
    'Claim travel expenses',
    'Liquidar los gastos de viaje',
    'Faire la note de frais',
    'Prestar contas das despesas de viagem',
  ],
  Wochenplanung: [
    'Weekly planning',
    'Planificación semanal',
    'Planification de la semaine',
    'Planejamento da semana',
  ],
  'Geschenk für Oma besorgen': [
    'Get a gift for Grandma',
    'Comprar un regalo para la abuela',
    'Trouver un cadeau pour Mamie',
    'Comprar um presente para a vovó',
  ],
  'Zahnbürsten kaufen': [
    'Buy toothbrushes',
    'Comprar cepillos de dientes',
    'Acheter des brosses à dents',
    'Comprar escovas de dentes',
  ],
  'Paket zur Post bringen': [
    'Take parcel to the post office',
    'Llevar el paquete a correos',
    'Déposer le colis à la poste',
    'Levar a encomenda ao correio',
  ],
  'Balkonmöbel streichen': [
    'Paint the balcony furniture',
    'Pintar los muebles del balcón',
    'Peindre les meubles du balcon',
    'Pintar os móveis da varanda',
  ],
  'Farbe kaufen': ['Buy paint', 'Comprar pintura', 'Acheter de la peinture', 'Comprar tinta'],
  Schleifen: ['Sand it down', 'Lijar', 'Poncer', 'Lixar'],
  'Kräutersamen bestellen': [
    'Order herb seeds',
    'Pedir semillas de hierbas',
    'Commander des graines d’aromatiques',
    'Encomendar sementes de ervas',
  ],
  'Rechnung bezahlen': ['Pay the bill', 'Pagar la factura', 'Payer la facture', 'Pagar a conta'],
  'Mail beantworten': [
    'Answer the email',
    'Responder al correo',
    'Répondre au mail',
    'Responder ao e-mail',
  ],
  'Termin vereinbaren': [
    'Make an appointment',
    'Pedir cita',
    'Prendre rendez-vous',
    'Marcar um horário',
  ],
  'Bücher aussortieren': [
    'Sort out books',
    'Seleccionar libros',
    'Trier les livres',
    'Separar livros',
  ],
  'Auto waschen': ['Wash the car', 'Lavar el coche', 'Laver la voiture', 'Lavar o carro'],
  'Ordner abheften': [
    'File the folders',
    'Archivar las carpetas',
    'Classer les dossiers',
    'Arquivar as pastas',
  ],
  Recherche: ['Research', 'Investigación', 'Recherche', 'Pesquisa'],
  'Vorräte prüfen': [
    'Check supplies',
    'Revisar las provisiones',
    'Vérifier les provisions',
    'Conferir os mantimentos',
  ],
  'Fahrradreifen aufpumpen': [
    'Pump up the bike tyres',
    'Inflar las ruedas de la bici',
    'Gonfler les pneus du vélo',
    'Encher os pneus da bike',
  ],
  'Schritt 1': ['Step 1', 'Paso 1', 'Étape 1', 'Passo 1'],
  'Schritt 2': ['Step 2', 'Paso 2', 'Étape 2', 'Passo 2'],
};
const LANG_INDEX = { en: 0, es: 1, fr: 2, 'pt-BR': 3 } as const;
const tr = (ctx: SeedContext, de: string): string =>
  ctx.lang === 'de' ? de : (TR[de]?.[LANG_INDEX[ctx.lang]] ?? de);

const LISTS = [
  { name: 'Haushalt', color: '#2f7fb8' },
  { name: 'Arbeit', color: '#d9822b' },
  { name: 'Einkäufe & Besorgungen', color: '#3f9a6a' },
  { name: 'Projekt Balkon', color: '#8a5cc2' },
];

interface Base {
  list: number;
  title: string;
  due?: number;
  priority: number;
  done?: boolean;
  note?: string;
  /** Day offset of the plan ('Heute' = 0) and estimate in minutes. */
  plan?: number;
  est?: number;
  subs?: { title: string; done?: boolean }[];
}

const BASE: Base[] = [
  {
    list: 0,
    title: 'Steuererklärung vorbereiten',
    due: 0,
    priority: 3,
    est: 30,
    subs: [
      { title: 'Belege sortieren', done: true },
      { title: 'Formular ausfüllen' },
      { title: 'Abgeben' },
    ],
  },
  { list: 0, title: 'Fenster putzen', due: -2, priority: 1, plan: 0, est: 30 },
  { list: 0, title: 'Glühbirne im Flur wechseln', due: 3, priority: 0 },
  { list: 0, title: 'Keller aufräumen', priority: 1, note: 'Altes Regal entsorgen' },
  { list: 0, title: 'Waschmaschine entkalken', priority: 0, done: true, due: -6 },
  {
    list: 1,
    title: 'Quartalsbericht schreiben',
    due: 2,
    priority: 3,
    subs: [{ title: 'Zahlen einholen', done: true }, { title: 'Entwurf an Team' }],
  },
  { list: 1, title: 'Urlaubsantrag einreichen', due: 0, priority: 2, plan: 0, est: 5 },
  { list: 1, title: 'Präsentation proben', due: 4, priority: 2 },
  { list: 1, title: 'Reisekosten abrechnen', due: -4, priority: 2 },
  { list: 1, title: 'Wochenplanung', priority: 0, done: true, due: -1 },
  { list: 2, title: 'Geschenk für Oma besorgen', due: 2, priority: 2 },
  { list: 2, title: 'Zahnbürsten kaufen', priority: 0, plan: 0, est: 15 },
  { list: 2, title: 'Paket zur Post bringen', due: 1, priority: 1, done: true },
  {
    list: 3,
    title: 'Balkonmöbel streichen',
    due: 6,
    priority: 1,
    subs: [{ title: 'Farbe kaufen' }, { title: 'Schleifen' }],
  },
  { list: 3, title: 'Kräutersamen bestellen', priority: 0, done: true },
];
const TITLES = [
  'Rechnung bezahlen',
  'Mail beantworten',
  'Termin vereinbaren',
  'Bücher aussortieren',
  'Auto waschen',
  'Ordner abheften',
  'Recherche',
  'Formular ausfüllen',
  'Vorräte prüfen',
  'Fahrradreifen aufpumpen',
];

function seed(ctx: SeedContext): SeedRows {
  const nLists = ctx.count({ small: 3, medium: 4, large: 4 });
  const extra = ctx.count({ small: 0, medium: 25, large: 300 });
  const lists: SeedRow[] = LISTS.slice(0, nLists).map((l, i) => ({
    id: ctx.id('todos', 'list', i),
    data: { name: tr(ctx, l.name), color: l.color, order: i },
  }));
  const base = ctx.scale === 'small' ? BASE.filter((b) => b.list < nLists) : BASE;
  const all: Base[] = [...base];
  for (let i = 0; i < extra; i++) {
    const done = ctx.rng.chance(0.4);
    all.push({
      list: ctx.rng.int(0, nLists - 1),
      title: `${tr(ctx, ctx.rng.pick(TITLES))} ${i + 1}`,
      due: ctx.rng.chance(0.6) ? ctx.rng.int(-10, 21) : undefined,
      priority: ctx.rng.int(0, 3),
      done,
      subs: ctx.rng.chance(0.15)
        ? [
            { title: 'Schritt 1', done },
            { title: 'Schritt 2', done: false },
          ]
        : undefined,
    });
  }
  const tasks: SeedRow[] = [];
  const orderByList = new Map<number, number>();
  all.forEach((b, i) => {
    const order = (orderByList.get(b.list) ?? 0) + 1;
    orderByList.set(b.list, order);
    const id = ctx.id('todos', 'task', i);
    const listId = lists[b.list]!.id;
    const done = b.done ?? false;
    const data: Record<string, unknown> = {
      listId,
      title: tr(ctx, b.title),
      done,
      priority: b.priority,
      order,
    };
    if (b.due !== undefined) data.dueDate = ctx.day(b.due);
    if (b.note) data.note = tr(ctx, b.note);
    if (b.plan !== undefined && !done) data.plannedFor = ctx.day(b.plan);
    if (b.est !== undefined) data.estimateMin = b.est;
    if (done) data.completedAt = ctx.at(Math.min(b.due ?? -1, -1), '18:00');
    tasks.push({ id, data });
    (b.subs ?? []).forEach((s, j) => {
      const sd = s.done ?? false;
      const sub: Record<string, unknown> = {
        listId,
        title: tr(ctx, s.title),
        done: sd,
        priority: 0,
        parentId: id,
        order: j + 1,
      };
      if (sd) sub.completedAt = ctx.at(-1, '17:00');
      tasks.push({ id: ctx.id('todos', 'task', `${i}-${j}`), data: sub });
    });
  });
  return { list: lists, task: tasks };
}

export default { seed } satisfies SeedModule;
