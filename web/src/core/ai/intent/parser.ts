/**
 * Stage 1: a rule-based German intent parser. It costs no tokens and only answers when it
 * understands *every* word of the question (known vocabulary or harmless filler); anything else
 * is left to full text search or the model, so it never guesses.
 */
import { addDaysStr } from '@/core/time/dates';
import { fold } from '../text';
import { resolveRange } from '../query/range';
import type { Filter, Intent, RelativeRange } from '../query/schema';

export type ParseOutcome =
  | { kind: 'intent'; intent: Intent }
  | { kind: 'none'; /** Words that are neither vocabulary nor filler. */ unknown: string[] };

interface TimeSpec {
  rel?: RelativeRange;
  from?: string;
  to?: string;
}

interface ModuleRef {
  module: string;
  collection: string;
  filter?: Filter;
}

type Mod = 'open' | 'paid' | 'done' | 'active';
type Agg = 'count' | 'sum' | 'balance' | 'costs' | 'howmuch' | 'pay';

const tokenize = (s: string): string[] =>
  fold(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const FILLER = new Set(
  (
    'ich mein meine meinen meiner meines mir mich habe hab hat gibt es ein eine einen einem der die ' +
    'das den dem des und oder was welche welcher welches wie wann zeige zeig zeigen zeigt mal bitte ' +
    'alle noch steht stehen an ansteht anstehen anstehende ist sind sein soll sollte muss mussen ' +
    'liegt liegen gerade aktuell aktuelle aktuellen jetzt fur in im am auf zu von vom mit bei aus ' +
    'bis wird werden kommt kommen erledigen machen tun anstehenden gibts hier dieser diese diesen ' +
    'diesem fallig da so ja'
  ).split(' '),
);

const OPEN = new Set([
  'offen',
  'offene',
  'offenen',
  'offener',
  'unerledigte',
  'unerledigten',
  'unerledigt',
]);
const PAID = new Set(['bezahlt', 'bezahlte', 'bezahlten', 'beglichene', 'beglichen']);
const DONE = new Set(['erledigt', 'erledigte', 'erledigten', 'fertige', 'fertig']);
const ACTIVE = new Set(['aktiv', 'aktive', 'aktiven', 'laufende', 'laufenden']);
const OVERDUE = new Set([
  'uberfallig',
  'uberfallige',
  'uberfalligen',
  'uberfalliger',
  'uberfalliges',
]);

const MODULES: Record<string, ModuleRef> = {};
const addModule = (words: string[], ref: ModuleRef) => words.forEach((w) => (MODULES[w] = ref));
addModule(['rechnung', 'rechnungen'], { module: 'invoices', collection: 'invoice' });
addModule(['abo', 'abos', 'abonnement', 'abonnements', 'abbuchung', 'abbuchungen'], {
  module: 'subscriptions',
  collection: 'subscription',
});
addModule(['todo', 'todos', 'aufgabe', 'aufgaben'], { module: 'todos', collection: 'task' });
addModule(['termin', 'termine', 'kalender'], { module: 'calendar', collection: 'event' });
addModule(['erinnerung', 'erinnerungen'], { module: 'reminders', collection: 'reminder' });
addModule(['buchung', 'buchungen'], { module: 'finance', collection: 'transaction' });
addModule(['ausgabe', 'ausgaben', 'ausgegeben'], {
  module: 'finance',
  collection: 'transaction',
  filter: { field: 'kind', op: 'eq', value: 'expense' },
});
addModule(['einnahme', 'einnahmen', 'eingenommen'], {
  module: 'finance',
  collection: 'transaction',
  filter: { field: 'kind', op: 'eq', value: 'income' },
});

const BALANCE = new Set(['kontostand', 'guthaben', 'saldo', 'verfugbar', 'geld', 'konto']);
const SUM = new Set(['summe', 'gesamt', 'insgesamt', 'total', 'gesamtsumme']);
const COSTS = new Set(['kosten', 'kostet', 'kostenpunkt']);
const PAY = new Set(['bezahlen', 'zahlen', 'begleichen']);
const SEARCH = new Set(['suche', 'suchen', 'such', 'finde', 'finden', 'find']);

type Alt = string | string[];
interface Phrase {
  words: Alt[];
  time: (today: string) => TimeSpec;
}
const alts = (a: Alt, w: string) => (Array.isArray(a) ? a.includes(w) : a === w);
const rel = (r: RelativeRange) => () => ({ rel: r });
const THIS = ['diese', 'dieser', 'diesen', 'diesem', 'laufenden'];
const NEXT = ['nachste', 'nachsten', 'kommende', 'kommenden'];
const DAYS = ['tage', 'tagen'];
const LAST = ['letzte', 'letzten', 'letzter', 'vorigen', 'vergangenen'];

// Longest phrases first.
const TIME_PHRASES: Phrase[] = [
  { words: [NEXT, '7', DAYS], time: rel('next_7_days') },
  { words: [NEXT, 'sieben', DAYS], time: rel('next_7_days') },
  { words: [NEXT, 'woche'], time: rel('next_week') },
  { words: [NEXT, 'monat'], time: rel('next_month') },
  { words: [NEXT, DAYS], time: rel('next_7_days') },
  { words: [LAST, 'monat'], time: rel('last_month') },
  { words: [THIS, 'woche'], time: rel('this_week') },
  { words: [THIS, 'monat'], time: rel('this_month') },
  { words: ['7', DAYS], time: rel('next_7_days') },
  { words: ['woche'], time: rel('this_week') },
  { words: ['monat'], time: rel('this_month') },
  { words: ['heute'], time: rel('today') },
  { words: ['morgen'], time: rel('tomorrow') },
  { words: ['gestern'], time: rel('yesterday') },
  {
    words: ['ubermorgen'],
    time: (today) => ({ from: addDaysStr(today, 2), to: addDaysStr(today, 2) }),
  },
];

const AGENDA_MODULES = new Set(['calendar', 'todos', 'reminders', 'invoices', 'subscriptions']);

interface Scan {
  times: TimeSpec[];
  refs: ModuleRef[];
  mods: Set<Mod>;
  aggs: Set<Agg>;
  overdue: boolean;
  search: boolean;
  unknown: string[];
}

function scan(tokens: string[], today: string): Scan {
  const s: Scan = {
    times: [],
    refs: [],
    mods: new Set(),
    aggs: new Set(),
    overdue: false,
    search: false,
    unknown: [],
  };
  for (let i = 0; i < tokens.length;) {
    const phrase = TIME_PHRASES.find((p) =>
      p.words.every((w, k) => tokens[i + k] !== undefined && alts(w, tokens[i + k]!)),
    );
    if (phrase) {
      s.times.push(phrase.time(today));
      i += phrase.words.length;
      continue;
    }
    const w = tokens[i]!;
    if (w === 'wie' && (tokens[i + 1] === 'viel' || tokens[i + 1] === 'viele')) {
      s.aggs.add(tokens[i + 1] === 'viele' ? 'count' : 'howmuch');
      i += 2;
      continue;
    }
    if (w === 'to' && tokens[i + 1] === 'do') {
      s.refs.push(MODULES.todo!);
      i += 2;
      continue;
    }
    if (MODULES[w]) s.refs.push(MODULES[w]!);
    else if (OPEN.has(w)) s.mods.add('open');
    else if (PAID.has(w)) s.mods.add('paid');
    else if (DONE.has(w)) s.mods.add('done');
    else if (ACTIVE.has(w)) s.mods.add('active');
    else if (OVERDUE.has(w)) s.overdue = true;
    else if (BALANCE.has(w)) s.aggs.add('balance');
    else if (SUM.has(w)) s.aggs.add('sum');
    else if (COSTS.has(w)) s.aggs.add('costs');
    else if (PAY.has(w)) s.aggs.add('pay');
    else if (SEARCH.has(w)) s.search = true;
    else if (!FILLER.has(w)) s.unknown.push(w);
    i += 1;
  }
  return s;
}

/** Merges several time words ("heute und morgen") into one explicit range. */
function mergeTimes(times: TimeSpec[], today: string): TimeSpec {
  if (times.length === 1) return times[0]!;
  const ranges = times.map((t) => resolveRange({ relative: t.rel, from: t.from, to: t.to }, today));
  const froms = ranges.map((r) => r.from).filter((x): x is string => !!x);
  const tos = ranges.map((r) => r.to).filter((x): x is string => !!x);
  return { from: froms.sort()[0], to: tos.sort().at(-1) };
}

const eq = (field: string, value: string | boolean | number): Filter => ({
  field,
  op: 'eq',
  value,
});

function query(ref: ModuleRef, q: Partial<Extract<Intent, { type: 'query' }>['query']>): Intent {
  return {
    type: 'query',
    query: { module: ref.module, collection: ref.collection, filters: [], limit: 20, ...q },
  };
}

/** Default listing per module, shaped by modifiers ("bezahlte Rechnungen", "erledigte ToDos"). */
function listFor(ref: ModuleRef, s: Scan, time?: TimeSpec, count = false): Intent | undefined {
  const relative = time
    ? time.rel
      ? { relative: time.rel }
      : { from: time.from, to: time.to }
    : undefined;
  const aggregate = count ? { aggregate: 'count' } : {};
  switch (ref.module) {
    case 'invoices': {
      const paid = s.mods.has('paid');
      return query(ref, {
        filters: [eq('status', paid ? 'paid' : 'open')],
        sort: { field: paid ? 'paidAt' : 'dueDate', dir: paid ? 'desc' : 'asc' },
        ...(relative ? { range: { field: paid ? 'paidAt' : 'dueDate', ...relative } } : {}),
        ...aggregate,
      });
    }
    case 'todos': {
      const done = s.mods.has('done');
      return query(ref, {
        filters: [eq('done', done)],
        sort: { field: 'dueDate', dir: 'asc' },
        ...(relative ? { range: { field: 'dueDate', ...relative } } : {}),
        ...aggregate,
      });
    }
    case 'subscriptions':
      return query(ref, {
        filters: [eq('active', !s.mods.has('paid'))],
        sort: { field: 'name', dir: 'asc' },
        ...aggregate,
      });
    case 'reminders':
      return query(ref, {
        filters: [eq('active', true)],
        sort: { field: 'startDate', dir: 'asc' },
        ...(relative ? { range: { field: 'startDate', ...relative } } : {}),
        ...aggregate,
      });
    case 'finance':
      return query(ref, {
        filters: ref.filter ? [ref.filter] : [],
        sort: { field: 'date', dir: 'desc' },
        ...(relative ? { range: { field: 'date', ...relative } } : {}),
        ...(count
          ? aggregate
          : s.aggs.has('sum') || s.aggs.has('howmuch')
            ? { aggregate: 'sum:amountMinor' }
            : {}),
      });
    default:
      return undefined;
  }
}

function decide(s: Scan, today: string): Intent | undefined {
  const time = s.times.length > 0 ? mergeTimes(s.times, today) : undefined;
  const mods = new Set(s.refs.map((r) => r.module));
  const only = s.refs.length > 0 && mods.size === 1 ? s.refs[0]! : undefined;

  // "kontostand", "wie viel geld habe ich", "was ist verfügbar"
  if (s.aggs.has('balance') && !time && (mods.size === 0 || mods.has('finance'))) {
    return { type: 'computed', module: 'finance', name: 'balance' };
  }
  // "was kosten meine abos"
  if (s.aggs.has('costs') && only?.module === 'subscriptions' && !time) {
    return { type: 'computed', module: 'subscriptions', name: 'costs' };
  }
  // "wie viel muss ich noch bezahlen", "summe offene rechnungen"
  if (
    !time &&
    ((mods.size === 0 && s.aggs.has('howmuch') && s.aggs.has('pay')) ||
      (only?.module === 'invoices' &&
        (s.aggs.has('sum') || s.aggs.has('howmuch')) &&
        !s.mods.has('paid')))
  ) {
    return { type: 'computed', module: 'invoices', name: 'open' };
  }

  if (s.overdue) {
    if (only?.module === 'invoices' || only?.module === 'todos') {
      return listFor(only, s, { rel: 'overdue' });
    }
    return undefined;
  }

  const count = s.aggs.has('count');
  if (mods.size === 0) {
    // Time only ("was steht heute an") → everything on the timeline.
    if (time && s.aggs.size === 0 && s.mods.size === 0) {
      return { type: 'agenda', agenda: { ...(time.rel ? { relative: time.rel } : time) } };
    }
    return undefined;
  }
  if (!only) {
    // Several modules together only make sense as a timeline ("termine und aufgaben morgen").
    if (time && [...mods].every((m) => AGENDA_MODULES.has(m)) && !count) {
      return {
        type: 'agenda',
        agenda: { sources: [...mods], ...(time.rel ? { relative: time.rel } : time) },
      };
    }
    return undefined;
  }

  if (time) {
    const timeline =
      AGENDA_MODULES.has(only.module) &&
      !count &&
      !(only.module === 'invoices' && s.mods.has('paid')) &&
      !(only.module === 'todos' && s.mods.has('done'));
    if (timeline) {
      return {
        type: 'agenda',
        agenda: { sources: [only.module], ...(time.rel ? { relative: time.rel } : time) },
      };
    }
    return listFor(only, s, time, count);
  }
  if (only.module === 'calendar' && !count) {
    return { type: 'agenda', agenda: { sources: ['calendar'], relative: 'next_7_days' } };
  }
  return listFor(only, s, undefined, count);
}

export function parseIntent(question: string, opts: { today: string }): ParseOutcome {
  const tokens = tokenize(question);
  if (tokens.length === 0) return { kind: 'none', unknown: [] };
  const s = scan(tokens, opts.today);

  // "suche X": everything after the search verb is the search text.
  if (s.search) {
    const rest = question
      .replace(/^\s*(suche|suchen|such|finde|finden|find)\b\s*(nach\s+)?/i, '')
      .trim();
    if (rest) return { kind: 'intent', intent: { type: 'fulltext', text: rest.slice(0, 200) } };
  }
  if (s.unknown.length > 0) return { kind: 'none', unknown: s.unknown };
  const intent = decide(s, opts.today);
  return intent ? { kind: 'intent', intent } : { kind: 'none', unknown: [] };
}

/** Number of meaningful words: used to decide between full text search and the model. */
export function contentWordCount(question: string): number {
  return tokenize(question).filter((w) => !FILLER.has(w)).length;
}
