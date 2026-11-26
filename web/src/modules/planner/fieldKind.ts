/**
 * Kinds in the field (planner hub 2, package 3; CONCEPT-INTAKE idea 3, hand-off 03): what a line typed into the planner's
 * one field **surely** is, or nothing. Pure – the caller passes the day, the modules that are on and the names the
 * shopping list or the pantry knows (`knownShoppingNames`). Only a sure reading shows the preview line K1; everything
 * below the rules is a ToDo, exactly as before.
 *
 * Order of readings: the planner's own readings come first and are unchanged – a pasted plan (several lines), „Pause …“ /
 * „Freizeit …“, „heute nur …“, a lock word („fest“, „lock“, a closing „!“) and every instruction its rules read
 * („Do frei“). Then a sure kind that uses a date (Rechnung: the word and an amount; Termin: a day and a clock time)
 * wins over the planner's date reading and takes the date. A date word without a sure kind („Wäsche morgen“) stays
 * the planner's. Two kinds sure at once: the first of Rechnung, Termin, Einkaufsliste, Link, Notiz, Aufgabe mit
 * Schritten. German only, like the parser.
 */
import { trimTrailing, webAddress } from '@/core/net/webAddress';
import { parseInstruction, type InstructionItem } from '@/core/plan/instructions';
import { parseCapture, type CaptureFields } from '@/quickCapture/parser';
import { nameKey } from '@/quickCapture/targets/lookup';
import { extractLock, readFieldWithPart } from './dueWords';
import { looksLikePlan } from './pastePlan';

export type FieldKind =
  /** An invoice: payee (`fields.title`), amount, its deadline (said, or the capture's usual 14 days); `host` of an address kept as its note. */
  | { kind: 'invoice'; fields: CaptureFields; deadline: string; host?: string }
  /** Entries of the shopping list (one per comma). */
  | { kind: 'list'; names: string[] }
  /** An appointment: a day and a clock time. */
  | { kind: 'event'; fields: CaptureFields }
  /** A note: what follows „Notiz:“ / „Idee:“. */
  | { kind: 'note'; title: string }
  /** The Merkliste: one web address. */
  | { kind: 'bookmark'; url: string; host: string }
  /** One ToDo with a checklist: „Haushalt: Wäsche, Bad, Küche“. */
  | { kind: 'steps'; title: string; steps: string[] };

export type FieldKindName = FieldKind['kind'];

/** The capture type each kind is stored through, and so the module that must be on. */
export const KIND_MODULE: Record<FieldKindName, string> = {
  invoice: 'invoices',
  list: 'lists',
  event: 'calendar',
  note: 'notes',
  bookmark: 'bookmarks',
  steps: 'todos',
};

export interface FieldKindContext {
  now: Date;
  /** 'YYYY-MM-DD' */
  today: string;
  /** The last planned day: an invoice due later is not a thing of the plan yet, so the line says nothing. */
  until: string;
  /** Modules that are on (by id). */
  on: (moduleId: string) => boolean;
  /** Names the shopping list or the pantry knows, as `nameKey` gives them. */
  known?: ReadonlySet<string>;
  /** The plan's things, so an instruction about one („Milch auf Fr“) stays the planner's. */
  items?: readonly InstructionItem[];
}

/** At most this many steps from one line; a longer list is no sure reading (below core's `STEPS_MAX`). */
export const FIELD_STEPS_MAX = 20;
/** At most this many shopping entries from one line. */
export const LIST_MAX = 20;

const KEEP = /^(?:heute\s+)?nur\s/iu;
const SHOP_PREFIX = /^(?:einkauf|einkaufen|einkaufsliste)\s*:\s*(\S[\s\S]*)$/iu;
const SHOP_SUFFIX = /^(\S[\s\S]*?)\s+kaufen$/iu;
const NOTE_PREFIX = /^(?:notiz|idee)\s*:\s*(\S[\s\S]*)$/iu;
/** „Name: a, b“ – a colon followed by a space (no clock time, no address), a name without a digit at its start. */
const STEPS = /^([^\d:/\s][^:/]{0,79}?)\s*:\s+(\S[\s\S]*)$/u;
/** The invoice word as a word of its own („Rechnungen“, „Rechnungsadresse“ are not it). */
const INVOICE_WORD = /(?<![\p{L}\d])rechnung(?![\p{L}\d])/iu;
const DUNNING_WORD = /(?<![\p{L}\d])mahnung(?![\p{L}\d])/iu;

const parts = (s: string): string[] =>
  s
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

/** The planner's own readings: they come first, and a line one of them reads never gets a kind. */
function plannerReads(text: string, ctx: FieldKindContext): boolean {
  if (looksLikePlan(text) || /[\r\n]/.test(text)) return true;
  if (KEEP.test(text)) return true;
  if (extractLock(text, ctx.today)) return true;
  if (parseCapture(text, { now: ctx.now, defaultType: 'todo', breaks: true }).type === 'break')
    return true;
  return parseInstruction(text, { today: ctx.today, items: ctx.items ?? [] }).kind !== 'none';
}

function invoiceOf(text: string, ctx: FieldKindContext): FieldKind | undefined {
  if (!INVOICE_WORD.test(text) || DUNNING_WORD.test(text)) return undefined;
  // An address in the line is not the invoice's (the parser would make it a bookmark): kept as its note, through the
  // gate, and named on the line by its host. One the gate refuses: no sure reading.
  const token = /https?:\/\/\S+/iu.exec(text)?.[0];
  const web = token ? webAddress(trimTrailing(token)) : undefined;
  if (token && !web) return undefined;
  const line = token ? text.replace(token, ' ').replace(/\s+/gu, ' ').trim() : text;
  const r = parseCapture(line, { now: ctx.now, defaultType: 'todo' });
  const f = r.fields;
  if (r.type !== 'invoice' || f.dunning || !f.amountMinor || f.amountMinor < 1) return undefined;
  if (!f.title.trim() || (f.currency && f.currency !== 'EUR') || !f.date) return undefined;
  // The deadline the invoice gets – said, or the capture's usual 14 days – is on the line. One past the planned days
  // is not a thing of the plan yet, a rolled or impossible one is unsure: no line, a ToDo as today.
  if (f.date > ctx.until || r.notes.some((n) => n !== 'assumed-date')) return undefined;
  const fields: CaptureFields = {
    title: f.title.trim(),
    amountMinor: f.amountMinor,
    date: f.date,
    ...(web ? { note: web.url } : {}),
  };
  return { kind: 'invoice', fields, deadline: f.date, ...(web ? { host: web.host } : {}) };
}

function eventOf(text: string, ctx: FieldKindContext): FieldKind | undefined {
  const r = parseCapture(text, { now: ctx.now, defaultType: 'todo' });
  const f = r.fields;
  if (r.type !== 'event' || !f.date || !f.time || f.recurrence || f.allDay) return undefined;
  // The day must be said: an assumed or rolled day is no sure reading.
  if (r.notes.some((n) => n !== 'approx-time')) return undefined;
  if (f.date < ctx.today || !f.title.trim()) return undefined;
  return {
    kind: 'event',
    fields: {
      title: f.title.trim(),
      date: f.date,
      time: f.time,
      ...(f.endTime ? { endTime: f.endTime } : {}),
    },
  };
}

function listOf(text: string, ctx: FieldKindContext): FieldKind | undefined {
  const said = SHOP_PREFIX.exec(text)?.[1] ?? SHOP_SUFFIX.exec(text)?.[1];
  const names = said
    ? parts(said)
    : ctx.known?.has(nameKey(text)) && !text.includes(',')
      ? [text.trim().replace(/\s+/gu, ' ')]
      : [];
  if (names.length === 0 || names.length > LIST_MAX) return undefined;
  return { kind: 'list', names };
}

function bookmarkOf(text: string): FieldKind | undefined {
  if (!/^https?:\/\/\S+$/iu.test(text)) return undefined;
  const web = webAddress(text);
  return web ? { kind: 'bookmark', ...web } : undefined;
}

function noteOf(text: string): FieldKind | undefined {
  const title = NOTE_PREFIX.exec(text)?.[1]?.trim();
  return title ? { kind: 'note', title } : undefined;
}

function stepsOf(text: string, ctx: FieldKindContext): FieldKind | undefined {
  const m = STEPS.exec(text);
  if (!m) return undefined;
  const steps = parts(m[2]!);
  if (steps.length < 2 || steps.length > FIELD_STEPS_MAX) return undefined;
  const title = m[1]!.trim();
  // The name is stored as it reads: one the field would read a day, a part, minutes or a deadline from („Heute“,
  // „Haushalt Fr“) is no sure reading – the line could not say what Enter stores.
  const read = readFieldWithPart(title, ctx.now, ctx.today, true);
  const f = read.fields;
  if (read.isBreak || read.hardDue || read.part || f.title !== title) return undefined;
  if (f.date || f.time || f.estimateMin || f.priority || f.recurrence) return undefined;
  return { kind: 'steps', title, steps };
}

/** What the line surely is, or `undefined` (a ToDo, the planner's own reading, or a module that is off). */
export function fieldKind(raw: string, ctx: FieldKindContext): FieldKind | undefined {
  const text = raw.trim();
  if (!text || plannerReads(raw, ctx)) return undefined;
  const readers: [FieldKindName, () => FieldKind | undefined][] = [
    ['invoice', () => invoiceOf(text, ctx)],
    ['event', () => eventOf(text, ctx)],
    ['list', () => listOf(text, ctx)],
    ['bookmark', () => bookmarkOf(text)],
    ['note', () => noteOf(text)],
    ['steps', () => stepsOf(text, ctx)],
  ];
  for (const [kind, read] of readers) {
    const got = read();
    if (!got) continue;
    // The first sure kind decides; its module off means the line is a ToDo (never the next kind in the order).
    return ctx.on(KIND_MODULE[kind]) ? got : undefined;
  }
  return undefined;
}
