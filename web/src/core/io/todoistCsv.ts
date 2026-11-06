/**
 * Todoist CSV export (one file per project): header `TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,…,DATE,
 * DATE_LANG,…`. `TYPE` is `task`, `note` (a comment: becomes part of the description of the task
 * before it) or `section` (not a task). `PRIORITY` 1 is the highest, 4 none. `INDENT` 1 is top level.
 * `DATE` is plain text in the language of `DATE_LANG` ("15 Mar 2026", "every Monday") or ISO.
 * Newer exports add `DURATION` + `DURATION_UNIT` (`minute` / `day`): the planned length of the task.
 */
import type { Recurrence } from '@/core/recurrence/types';
import { parseCsv } from './csv';
import { parseDateInput } from './dates';
import type { ImportedTask, ParsedTaskExport } from './taskImport';

/** First three letters, accents removed → month. Covers de, en, es, fr, pt. */
const MONTHS: Record<string, number> = {
  jan: 1,
  ene: 1,
  feb: 2,
  fev: 2,
  mar: 3,
  apr: 4,
  abr: 4,
  avr: 4,
  may: 5,
  mai: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  ago: 8,
  sep: 9,
  set: 9,
  oct: 10,
  out: 10,
  okt: 10,
  nov: 11,
  dec: 12,
  dez: 12,
  dic: 12,
};

const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function monthOf(word: string): number | undefined {
  const w = plain(word).replace(/\.$/, '');
  if (w.startsWith('juil')) return 7;
  if (w.startsWith('juin')) return 6;
  return MONTHS[w.slice(0, 3)];
}

const RECURRING =
  /^(every|ev\b|each|daily|weekly|monthly|yearly|annually|jede[rsmn]?\b|alle\b|täglich|wöchentlich|monatlich|jährlich|cada\b|todos? (los|las)\b|tous les|toutes les|chaque|diari|semanal|mensal|anual|todo[s]? (o|os|as|a)\b)/i;

const TIME = /\s*(?:\b(?:at|um|à|a las|às|as)\s+)?\b\d{1,2}:\d{2}(?:\s?[ap]m)?\b/gi;

/** The calendar day a plain-language DATE names, if it names one outright. */
export function parseTodoistDate(
  raw: string,
  today: string,
): { due?: string; hint?: { text: string; recurring: boolean } } {
  const text = raw.trim();
  if (!text) return {};
  const iso = /^(\d{4}-\d{2}-\d{2})(?:[T ]|$)/.exec(text);
  if (iso) {
    const due = parseDateInput(iso[1]!);
    if (due) return { due };
  }
  if (RECURRING.test(text)) return { hint: { text, recurring: true } };
  const rest = text.replace(TIME, '').replace(/\s+/g, ' ').trim();
  const year = Number(today.slice(0, 4));
  const build = (y: number, m: number | undefined, d: number): string | undefined =>
    m ? parseDateInput(`${y}-${m}-${d}`) : undefined;
  // "15 Mar 2026", "15. März", "15 de marzo de 2026"
  let m = /^(\d{1,2})\.?\s+(?:de\s+)?([\p{L}]+)\.?(?:,?\s+(?:de\s+)?(\d{4}))?$/u.exec(rest);
  let due = m && build(m[3] ? Number(m[3]) : year, monthOf(m[2]!), Number(m[1]));
  // "Mar 15 2026", "Mar 15th"
  if (!due) {
    m = /^([\p{L}]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/u.exec(rest);
    due = m && build(m[3] ? Number(m[3]) : year, monthOf(m[1]!), Number(m[2]));
  }
  due ??= parseDateInput(rest);
  return due ? { due } : { hint: { text, recurring: false } };
}

/** Weekday words (en, de) → ISO weekday. */
const WEEKDAY: Record<string, number> = {
  mon: 1,
  monday: 1,
  montag: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  dienstag: 2,
  wed: 3,
  wednesday: 3,
  mittwoch: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  donnerstag: 4,
  fri: 5,
  friday: 5,
  freitag: 5,
  sat: 6,
  saturday: 6,
  samstag: 6,
  sun: 7,
  sunday: 7,
  sonntag: 7,
};

const UNIT: Record<string, Recurrence['freq']> = {
  day: 'daily',
  days: 'daily',
  tag: 'daily',
  tage: 'daily',
  week: 'weekly',
  weeks: 'weekly',
  woche: 'weekly',
  wochen: 'weekly',
  month: 'monthly',
  months: 'monthly',
  monat: 'monthly',
  monate: 'monthly',
  year: 'yearly',
  years: 'yearly',
  jahr: 'yearly',
  jahre: 'yearly',
};

const ADVERB: Record<string, Recurrence['freq']> = {
  daily: 'daily',
  täglich: 'daily',
  weekly: 'weekly',
  wöchentlich: 'weekly',
  monthly: 'monthly',
  monatlich: 'monthly',
  yearly: 'yearly',
  annually: 'yearly',
  jährlich: 'yearly',
};

/**
 * The repeat rule of a Todoist `DATE` text in English or German ("every 2 weeks", "every mon, fri",
 * "every weekday", "jeden Montag", "alle 3 Tage", "every 15th"), when it maps onto the app's model.
 * Times ("at 9am") are dropped; "every!" (repeat from completion) counts like "every". Anything
 * else – "every last friday", "every 3rd monday" – returns `undefined` and stays a hint.
 */
export function parseTodoistRepeat(raw: string): Recurrence | undefined {
  const text = plain(raw)
    .replace(TIME, '')
    .replace(/\b(?:at|um)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|uhr)?\b/g, '')
    .replace(/\b(?:starting|from|ab|until|bis)\b.*$/, '')
    .replace(/!/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const adverb = Object.entries(ADVERB).find(([word]) => plain(word) === text)?.[1];
  if (adverb) return { freq: adverb, interval: 1 };
  const m = /^(?:every|each|ev|jede[rsmn]?|alle)\s+(.+)$/.exec(text);
  if (!m) return undefined;
  let rest = m[1]!.trim();
  let interval = 1;
  const other = /^other\s+(.+)$/.exec(rest);
  if (other) {
    interval = 2;
    rest = other[1]!;
  }
  const n = /^(\d{1,3})\.?\s+(.+)$/.exec(rest);
  if (n) {
    interval = Number(n[1]);
    rest = n[2]!;
  }
  if (interval < 1 || interval > 999) return undefined;
  if (UNIT[rest]) return { freq: UNIT[rest]!, interval };
  if (interval !== 1) return undefined;
  if (/^(?:weekday|workday|werktag|arbeitstag)$/.test(rest))
    return { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] };
  const day = /^(\d{1,2})(?:st|nd|rd|th|\.)?$/.exec(rest);
  if (day && Number(day[1]) >= 1 && Number(day[1]) <= 31)
    return { freq: 'monthly', interval: 1, byMonthDay: Number(day[1]) };
  const days = rest.split(/\s*(?:,|\band\b|\bund\b)\s*/).filter(Boolean);
  const weekdays = days.map((d) => WEEKDAY[d.replace(/\.$/, '')]);
  if (weekdays.length > 0 && weekdays.every((d) => d !== undefined))
    return {
      freq: 'weekly',
      interval: 1,
      byWeekday: [...new Set(weekdays as number[])].sort((a, b) => a - b),
    };
  return undefined;
}

/** `DURATION` in minutes when the unit is minutes; a duration in days is no effort estimate. */
export function todoistMinutes(value: string, unit: string): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || !/^min/i.test(unit.trim())) return undefined;
  return Math.min(480, Math.max(1, Math.round(n)));
}

const PRIORITY: Record<string, ImportedTask['priority']> = { '1': 3, '2': 2, '3': 1 };

export function parseTodoistCsv(
  text: string,
  opts: { listName: string; today?: string },
): ParsedTaskExport {
  const rows = parseCsv(text, { delimiter: ',' });
  const header = (rows[0] ?? []).map((h) => h.trim().toUpperCase());
  const col = (name: string) => header.indexOf(name);
  const [iType, iContent, iDesc, iPrio, iIndent, iDate, iDuration, iUnit] = [
    'TYPE',
    'CONTENT',
    'DESCRIPTION',
    'PRIORITY',
    'INDENT',
    'DATE',
    'DURATION',
    'DURATION_UNIT',
  ].map(col) as [number, number, number, number, number, number, number, number];
  if (iType < 0 || iContent < 0) return { tasks: [], skipped: 0 };
  const today = opts.today ?? '1970-01-01';
  const at = (row: string[], i: number) => (i < 0 ? '' : (row[i] ?? '').trim());

  const tasks: ImportedTask[] = [];
  let skipped = 0;
  let last: ImportedTask | undefined;
  /** Open top-level task per nesting depth, so INDENT 3+ lands under its top-level ancestor. */
  let topLevel: ImportedTask | undefined;
  const addDescription = (task: ImportedTask, more: string) => {
    task.description = task.description ? `${task.description}\n\n${more}` : more;
  };

  for (const row of rows.slice(1)) {
    const type = at(row, iType).toLowerCase();
    const content = at(row, iContent);
    if (type === 'note') {
      if (last && content) addDescription(last, content);
      continue;
    }
    if (type !== 'task') {
      if (type === 'section') skipped++;
      continue; // blank separator rows
    }
    if (!content) {
      skipped++;
      continue;
    }
    const indent = Math.max(1, Number(at(row, iIndent)) || 1);
    const task: ImportedTask = {
      key: `t${tasks.length}`,
      title: content,
      priority: PRIORITY[at(row, iPrio)] ?? 0,
      done: false,
      list: opts.listName,
    };
    const description = at(row, iDesc);
    if (description) task.description = description;
    const date = parseTodoistDate(at(row, iDate), today);
    if (date.due) task.due = date.due;
    if (date.hint) {
      const rule = date.hint.recurring ? parseTodoistRepeat(date.hint.text) : undefined;
      if (rule) task.recurrence = rule;
      else task.dateHint = date.hint;
    }
    const minutes = todoistMinutes(at(row, iDuration), at(row, iUnit));
    if (minutes) task.estimateMin = minutes;
    if (indent === 1 || !topLevel) topLevel = task;
    else task.parentKey = topLevel.key;
    tasks.push(task);
    last = task;
  }
  return { tasks, skipped };
}
