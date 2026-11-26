import { getLang } from '@/core/i18n/lang';
import { DEFAULT_CURRENCY, formatMoney } from '@/core/money';
import { randomId } from '@/core/db/util';
import { now } from '@/core/time/now';
import { resolvePlace } from '@/core/time/placeSearch';
import { addDaysStr, formatDay, nowTime } from '@/core/time/dates';
import { t } from '@/strings';
import type { CaptureFields } from '../parser';
import {
  CaptureError,
  type AmendContext,
  type BuildContext,
  type CaptureFieldSpec,
  type CaptureTarget,
  type OpenInvoice,
  type SavedCapture,
} from './types';

/** The title as the first field of most targets (a required one: `title()` rejects an empty one). */
const TITLE: CaptureFieldSpec = { key: 'title', input: 'text', label: 'title', required: true };

/** Shared guard: adapters reject an empty title instead of writing a blank record. */
function title(fields: CaptureFields): string {
  const value = fields.title.trim();
  if (!value) throw new CaptureError('invalid');
  return value;
}

/** The schemas only check the `YYYY-MM-DD` shape, so impossible dates are rejected here. */
function date(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m && new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  if (!m || !d || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) {
    throw new CaptureError('invalid');
  }
  return value;
}

/** The free text of a capture (e.g. the link to the mail it came from) as the record's `note`; empty parts are left out. */
function noteOf(...parts: (string | undefined)[]): { note?: string } {
  const text = parts.filter((p): p is string => !!p?.trim()).join('\n');
  return text ? { note: text } : {};
}

const todos: CaptureTarget = {
  type: 'todo',
  fields: [TITLE, { key: 'date', input: 'day', label: 'due' }],
  moduleId: 'todos',
  collection: 'task',
  // `listId` comes from the module's `aiCreateDefaults` (the inbox list).
  build: (f) => {
    // A deadline's hour („bis So 18:00“) is the ToDo's `dueTime`; any other typed time stays a note line.
    const dueHour = f.time && f.date && (f.deadline || f.hardDue) ? f.time : undefined;
    return {
      title: title(f),
      ...(f.date ? { dueDate: date(f.date) } : {}),
      ...(f.startDate ? { startDate: date(f.startDate) } : {}),
      ...(f.estimateMin ? { estimateMin: f.estimateMin } : {}),
      ...(f.priority ? { priority: f.priority } : {}),
      ...(dueHour ? { dueTime: dueHour } : {}),
      ...noteOf(f.time && !dueHour ? t.quickCapture.todoTimeNote(f.time) : undefined, f.note),
      ...(f.link ? { links: [f.link] } : {}),
      ...checklistOf(f.checklist),
    };
  },
};

/** At most this many tick-off lines from one capture (a pasted paragraph is no checklist). */
export const CHECKLIST_MAX = 30;

/** The capture's lines as the task's checklist: trimmed, empty ones dropped, each with its own id. */
function checklistOf(lines: readonly string[] | undefined): { checklist?: object[] } {
  const kept = (lines ?? []).map((l) => l.trim()).filter(Boolean);
  if (kept.length === 0) return {};
  if (kept.length > CHECKLIST_MAX) throw new CaptureError('invalid');
  return { checklist: kept.map((text) => ({ id: randomId(), text, done: false })) };
}

const calendar: CaptureTarget = {
  type: 'event',
  fields: [
    TITLE,
    { key: 'date', input: 'day', label: 'date' },
    { key: 'time', input: 'time', label: 'time' },
  ],
  moduleId: 'calendar',
  collection: 'event',
  build: (f, ctx: BuildContext) => {
    const startDate = date(f.date ?? ctx.today)!;
    // A range that ends before it starts ("21:30 bis 06:30") is a night shift: it ends the next day.
    const overnight = !!f.time && !!f.endTime && f.endTime < f.time;
    return {
      title: title(f),
      startDate,
      allDay: !f.time,
      ...(f.time ? { startTime: f.time } : {}),
      ...(f.time && f.endTime ? { endTime: f.endTime } : {}),
      ...(overnight ? { endDate: addDaysStr(startDate, 1) } : {}),
      ...(f.recurrence ? { recurrence: f.recurrence } : {}),
      ...noteOf(f.note),
    };
  },
};

const reminders: CaptureTarget = {
  type: 'reminder',
  fields: [
    TITLE,
    { key: 'date', input: 'day', label: 'when' },
    { key: 'time', input: 'time', label: 'time' },
  ],
  // A reminder is a calendar event of the kind "reminder" that notifies at its time (since 0.7.0).
  // „einmal“ (`once`): a reminder made here notifies exactly once at its time – no lead, stage or
  // repeat (decision Q4 a); reminders set in the calendar dialog keep the global rule.
  moduleId: 'calendar',
  collection: 'event',
  build: (f, ctx) => ({
    title: title(f),
    kind: 'reminder',
    allDay: false,
    startDate: date(f.date ?? ctx.today),
    startTime: f.time ?? '09:00',
    notify: { minutesBefore: 0, enabled: true },
    once: true,
    ...(f.recurrence ? { recurrence: f.recurrence } : {}),
    ...noteOf(f.note),
  }),
};

/** Only http(s) links are kept; anything else stays in the title. */
function httpUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * First word of a Merkzettel → its kind ("m film Dune" → Film/Serie „Dune“). German like the parser; the
 * values are the kinds of `modules/bookmarks/schema.ts` (no module import here; `targets.test.ts` pins them).
 */
const BOOKMARK_KIND_WORDS: Record<string, string> = {
  lesen: 'read',
  artikel: 'read',
  film: 'watch',
  serie: 'watch',
  ansehen: 'watch',
  anschauen: 'watch',
  buch: 'book',
  ort: 'place',
  kaufen: 'buy',
  ausprobieren: 'try',
  idee: 'idea',
};

/** "film: Dune" → kind `watch`, title "Dune". A word alone ("Buch") stays the title. */
export function bookmarkKindFromText(text: string): { kind?: string; title: string } {
  const match = /^(\p{L}+)(?::\s*|\s+)(\S[\s\S]*)$/u.exec(text.trim());
  const kind = match ? BOOKMARK_KIND_WORDS[match[1]!.toLowerCase()] : undefined;
  return kind ? { kind, title: match![2]!.trim() } : { title: text.trim() };
}

const bookmarks: CaptureTarget = {
  type: 'bookmark',
  fields: [TITLE, { key: 'url', input: 'text', label: 'url' }],
  moduleId: 'bookmarks',
  collection: 'item',
  // Direct write: the module's dedupe service (`bookmark.requested`) only runs in the main window.
  build: (f) => {
    const url = httpUrl(f.url);
    const said = bookmarkKindFromText(f.title);
    const name = said.title || (url ? new URL(url).hostname : '');
    if (!name) throw new CaptureError('invalid');
    return {
      title: name,
      kind: said.kind ?? 'link',
      ...(url ? { url } : {}),
    };
  },
};

/** The text becomes an entry of the shopping list as typed ("2 Milch"); `listId` comes from the module's `aiCreateDefaults`. */
const lists: CaptureTarget = {
  type: 'list',
  fields: [TITLE],
  moduleId: 'lists',
  collection: 'item',
  build: (f) => ({ name: title(f), done: false }),
  // The planner lists a shopping list as one thing, never one per entry.
  planRef: (data) =>
    typeof data.listId === 'string' && data.listId
      ? { moduleId: 'lists', id: data.listId }
      : undefined,
};

const finance: CaptureTarget = {
  type: 'finance',
  fields: [
    { key: 'title', input: 'text', label: 'payee' },
    { key: 'amountMinor', input: 'money', label: 'amount', required: true },
    { key: 'date', input: 'day', label: 'date' },
  ],
  moduleId: 'finance',
  collection: 'transaction',
  requiresConfirm: true,
  // `accountId` comes from the module's `aiCreateDefaults` (the primary account).
  build: (f, ctx) => {
    if (!f.amountMinor || f.amountMinor < 1) throw new CaptureError('invalid');
    // The account's currency is not known here: an amount in another one goes to the full form.
    if (f.currency && f.currency !== DEFAULT_CURRENCY)
      throw new CaptureError('currency', f.currency);
    return {
      kind: f.kind ?? 'expense',
      amountMinor: f.amountMinor,
      date: date(f.date ?? ctx.today),
      ...(f.title.trim() ? { payee: f.title.trim() } : {}),
    };
  },
};

const invoices: CaptureTarget = {
  type: 'invoice',
  fields: [
    { key: 'title', input: 'text', label: 'payee', required: true },
    { key: 'amountMinor', input: 'money', label: 'amount', required: true },
    { key: 'date', input: 'day', label: 'due' },
    { key: 'reference', input: 'text', label: 'reference' },
  ],
  moduleId: 'invoices',
  collection: 'invoice',
  // The payee is the text left over after the amount, the due date and the word "Rechnung".
  build: (f, ctx) => {
    if (!f.amountMinor || f.amountMinor < 1 || !f.title.trim()) throw new CaptureError('invalid');
    return {
      payee: f.title.trim(),
      amountMinor: f.amountMinor,
      ...(f.currency ? { currency: f.currency } : {}),
      dueDate: date(f.date ?? ctx.today),
      status: 'open',
      ...(f.reference?.trim() ? { reference: f.reference.trim() } : {}),
      // A reminder for an invoice that was not filed yet: the invoice starts at its level.
      ...(f.dunning
        ? {
            dunningLevel: Math.min(3, Math.max(1, f.dunning.level)),
            dunnedAt: date(f.dunning.date),
          }
        : {}),
      ...noteOf(f.note),
    };
  },
  amend: amendInvoice,
};

/** What is still open on an invoice row: amount minus part payments, cents (shared with `lookup.ts`). */
export const openRest = (row: Record<string, unknown>): number =>
  (Number(row.amountMinor) || 0) -
  (Array.isArray(row.payments)
    ? (row.payments as { amountMinor?: number }[]).reduce((n, p) => n + (p.amountMinor ?? 0), 0)
    : 0);

/**
 * A payment reminder on its open invoice: writes the level + 1 (at most 3), the day of the reminder, one
 * appended note line and – where the reminder states them – its deadline and amount as the fields
 * `dunnedDueDate` / `dunnedAmountMinor` (planner hub S1, L6: the planner needs a date, not prose). Never the
 * invoice's own amount or due date (money changes only in the editor). Noting the same reminder again does
 * nothing. The undo removes only that line and resets each field only while it still holds what was written;
 * it never removes the invoice.
 */
async function amendInvoice(
  f: CaptureFields,
  match: OpenInvoice,
  ctx: AmendContext,
): Promise<SavedCapture> {
  const { repo } = ctx;
  const row = (await repo.get(match.id)) as Record<string, unknown> | undefined;
  if (!row || row.status === 'paid' || openRest(row) <= 0) throw new CaptureError('stale');
  const day = date(f.dunning?.date ?? ctx.today)!;
  const base = { id: match.id, type: 'invoice' as const, moduleId: 'invoices' };
  const before = {
    level: row.dunningLevel as number | undefined,
    at: row.dunnedAt as string | undefined,
    due: row.dunnedDueDate as string | undefined,
    amount: row.dunnedAmountMinor as number | undefined,
  };
  if (before.at && before.at >= day)
    return { ...base, amended: true, existed: true, undo: async () => undefined };
  const level = Math.min(3, (before.level ?? 0) + 1);
  // The invoice's own currency and today's rest when the line names no amount (never the preview's).
  const currency = f.currency ?? (row.currency as string | undefined);
  const line = t.quickCapture.dunningNote(
    formatDay(day, 'dd.MM.yyyy'),
    formatMoney(f.amountMinor ?? openRest(row), currency),
    f.date ? formatDay(f.date, 'dd.MM.yyyy') : undefined,
  );
  const note = [row.note as string | undefined, line].filter(Boolean).join('\n');
  // What this reminder claims; one that names no deadline or amount leaves the earlier claim as it is.
  const due = f.date ? date(f.date) : undefined;
  const amount = f.amountMinor && f.amountMinor > 0 ? f.amountMinor : undefined;
  await repo.update(match.id, {
    dunningLevel: level,
    dunnedAt: day,
    note,
    ...(due ? { dunnedDueDate: due } : {}),
    ...(amount ? { dunnedAmountMinor: amount } : {}),
  });
  return {
    ...base,
    amended: true,
    undo: async () => {
      const now = (await repo.get(match.id)) as Record<string, unknown> | undefined;
      if (!now) return;
      const patch: Record<string, unknown> = {};
      const text = typeof now.note === 'string' ? now.note : '';
      // Exactly the line and the one line break that joined it; the person's own text stays as it is.
      const at = text.lastIndexOf(line);
      if (at >= 0) {
        const end = at + line.length;
        const kept =
          at > 0 && text[at - 1] === '\n'
            ? text.slice(0, at - 1) + text.slice(end)
            : text.slice(0, at) + text.slice(text[end] === '\n' ? end + 1 : end);
        patch.note = kept || undefined;
      }
      if (now.dunningLevel === level) patch.dunningLevel = before.level;
      if (now.dunnedAt === day) patch.dunnedAt = before.at;
      if (due && now.dunnedDueDate === due) patch.dunnedDueDate = before.due;
      if (amount && now.dunnedAmountMinor === amount) patch.dunnedAmountMinor = before.amount;
      if (Object.keys(patch).length > 0) await repo.update(match.id, patch);
    },
  };
}

/** Fitness (docs/features/fitness.md §5): a meal with rough kcal, a session with its exercises. */
const meal: CaptureTarget = {
  type: 'meal',
  fields: [
    TITLE,
    { key: 'kcal', input: 'number', label: 'kcal', required: true },
    { key: 'date', input: 'day', label: 'date' },
  ],
  moduleId: 'fitness',
  collection: 'meal',
  build: (f, ctx) => {
    if (f.kcal === undefined || !f.title.trim()) throw new CaptureError('invalid');
    return {
      text: f.title.trim(),
      kcal: f.kcal,
      date: date(f.date ?? ctx.today),
      // Logged now unless a past day was typed („gestern kcal 400 Pizza“).
      ...(!f.date || f.date === ctx.today ? { time: nowTime() } : {}),
    };
  },
};

const workout: CaptureTarget = {
  type: 'workout',
  fields: [],
  moduleId: 'fitness',
  collection: 'session',
  build: (f, ctx) => {
    if (!f.exercises?.length) throw new CaptureError('invalid');
    return {
      date: date(f.date ?? ctx.today),
      ...(!f.date || f.date === ctx.today ? { time: nowTime() } : {}),
      exercises: f.exercises.map((e) => ({ ...e })),
    };
  },
};

/**
 * Uhr: „uhr Tokio“ → a place named like the city in the UI language, at the end of the list (an order above any
 * the page hands out; the page renumbers on the next move). Offline city search, never a guess on a loose match.
 */
const place: CaptureTarget = {
  type: 'place',
  fields: [],
  moduleId: 'clock',
  collection: 'place',
  build: (f) => {
    const hit = resolvePlace(f.title, getLang());
    if (!hit) throw new CaptureError('invalid');
    // `build` cannot read the list, so the order is the time in seconds: always after the page's 0, 1, 2 …
    // (`addPlace` then continues after it; only the relative order matters).
    return { label: hit.name, zone: hit.zone, order: Math.floor(now() / 1000) };
  },
  // = `MAX_PLACES` in `modules/clock/repo.ts` (no module import here; `clock.targets.test.ts` pins it).
  maxActive: { count: 12, text: () => t.clock.fullCapture(12) },
};

const subscriptions: CaptureTarget = {
  type: 'subscription',
  fields: [
    { key: 'title', input: 'text', label: 'name', required: true },
    { key: 'amountMinor', input: 'money', label: 'amount', required: true },
    { key: 'recurrence', input: 'rhythm', label: 'rhythm', required: true },
    { key: 'date', input: 'day', label: 'start' },
  ],
  moduleId: 'subscriptions',
  collection: 'subscription',
  build: (f, ctx) => {
    if (!f.amountMinor || f.amountMinor < 1 || !f.recurrence) throw new CaptureError('invalid');
    return {
      name: title(f),
      amountMinor: f.amountMinor,
      ...(f.currency ? { currency: f.currency } : {}),
      recurrence: f.recurrence,
      startDate: date(f.date ?? ctx.today),
    };
  },
};

/** A birthday becomes a person; without a known year the age stays unknown. */
const people: CaptureTarget = {
  type: 'birthday',
  fields: [
    { key: 'title', input: 'text', label: 'name', required: true },
    { key: 'date', input: 'day', label: 'birthday', required: true },
  ],
  moduleId: 'people',
  collection: 'person',
  build: (f) => {
    const m = f.date ? /^\d{4}-(\d{2})-(\d{2})$/.exec(date(f.date)!) : null;
    if (!m) throw new CaptureError('invalid');
    return { name: title(f), birthday: { month: Number(m[1]), day: Number(m[2]) } };
  },
};

const notes: CaptureTarget = {
  type: 'note',
  fields: [TITLE],
  moduleId: 'notes',
  collection: 'note',
  build: (f) => {
    const body = [f.note, f.url].filter(Boolean).join('\n');
    if (!f.title.trim() && !body) throw new CaptureError('invalid');
    return { title: f.title.trim(), body };
  },
};

/** The planner's key of a thing from a module (`<moduleId>:<id>`): its item and its assignments carry it. */
export const planItemKey = (moduleId: string, id: string): string => `${moduleId}:${id}`;

/**
 * „p Steuer 2 Std bis Do“: a ToDo (through the `todo` target, so the backlog stays in ToDos) plus its
 * planner item `todos:<id>` with what only the planner holds – the pin of a plain day or the hard
 * due of a deadline word; „ab Do“ is the ToDo's own `startDate` (the planner reads it as earliest).
 */
const plan: CaptureTarget = {
  type: 'plan',
  fields: [
    TITLE,
    { key: 'estimateMin', input: 'minutes', label: 'duration' },
    { key: 'date', input: 'day', label: 'deadline', with: { hardDue: true } },
  ],
  moduleId: 'planner',
  collection: 'item',
  via: { type: 'todo', id: (first) => planItemKey(first.moduleId, first.id) },
  build: (f, ctx, first) => {
    // The checks of the first stage (a title, real dates) hold for the plan entry too.
    todos.build(f, ctx);
    const pinned = date(f.pin);
    return {
      source: { module: first?.moduleId ?? 'todos', id: first?.id ?? 'new' },
      order: 0,
      ...(pinned ? { pinned } : {}),
      ...(f.hardDue && f.date
        ? { due: { date: date(f.date), hard: true, ...(f.time ? { time: f.time } : {}) } }
        : {}),
    };
  },
};

/** A break without a typed span or length blocks one hour (TARGET F2). */
export const BREAK_DEFAULT_MIN = 60;

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * What a „Pause …“ line blocks: its day (typed ?? today), its length (the typed span, else the typed length,
 * else an hour) and its times only when both were typed („Pause Sa 14 bis 16 Uhr“). A span over midnight is
 * not a break of one day: its times are dropped, the length stays.
 */
export function breakOf(
  f: CaptureFields,
  ctx: BuildContext,
): { date: string; label: string; min: number; from?: string; to?: string } {
  const day = date(f.date ?? ctx.today)!;
  const label = title(f);
  const span = f.time && f.endTime ? toMin(f.endTime) - toMin(f.time) : 0;
  if (span > 0) return { date: day, label, min: span, from: f.time, to: f.endTime };
  const min =
    f.estimateMin && f.estimateMin > 0 ? Math.min(1440, f.estimateMin) : BREAK_DEFAULT_MIN;
  return { date: day, label, min };
}

type DayRow = {
  date: string;
  availableMin?: number;
  blockers: { id: string; label: string; min: number; from?: string; to?: string }[];
  note?: string;
  from?: string;
  to?: string;
};

const ENVELOPE = ['id', 'createdAt', 'updatedAt', 'deviceId', 'deletedAt', '_f'];

/** The data fields of a stored day row, all of them (the envelope is the repo's): a field added later survives a break. */
const dayData = (row: Record<string, unknown>): DayRow => {
  const data = Object.fromEntries(
    Object.entries(row).filter(([k, v]) => !ENVELOPE.includes(k) && v !== undefined),
  ) as DayRow;
  return { ...data, blockers: [...(data.blockers ?? [])] };
};

/**
 * „Pause 2 Std Zocken“ with the planner on: a blocker of the planner's day row (id = the date, as the planner
 * writes it), never a ToDo – leisure is no task that stays open. The undo takes out only this blocker.
 */
const breaks: CaptureTarget = {
  type: 'break',
  fields: [],
  moduleId: 'planner',
  collection: 'day',
  build: (f, ctx) => {
    const b = breakOf(f, ctx);
    return {
      date: b.date,
      blockers: [
        {
          id: 'new',
          label: b.label,
          min: b.min,
          ...(b.from && b.to ? { from: b.from, to: b.to } : {}),
        },
      ],
    };
  },
  async save(f, ctx) {
    const b = breakOf(f, ctx);
    const { repo } = ctx;
    const id = randomId();
    const blocker = {
      id,
      label: b.label,
      min: b.min,
      ...(b.from && b.to ? { from: b.from, to: b.to } : {}),
    };
    // A day removed earlier (a tombstone) comes back empty, as the planner's own `dayPatch` starts it: read before
    // the restore, so no old blocker, minutes or window return with it.
    const stored = await repo.table.get(b.date);
    const fresh = !stored || stored.deletedAt !== null;
    if (stored && stored.deletedAt !== null) await repo.restore(b.date);
    const base: DayRow = fresh ? { date: b.date, blockers: [] } : dayData(stored);
    try {
      await repo.upsert(b.date, { ...base, blockers: [...base.blockers, blocker] });
    } catch {
      throw new CaptureError('invalid');
    }
    return {
      id: b.date,
      type: 'break',
      moduleId: 'planner',
      undo: async () => {
        const now = await repo.get(b.date);
        if (!now) return;
        const data = dayData(now);
        if (!data.blockers.some((x) => x.id === id)) return;
        const rest = { ...data, blockers: data.blockers.filter((x) => x.id !== id) };
        // A day this save brought in goes again when nothing else was put on it meanwhile.
        const untouched =
          rest.blockers.length === 0 &&
          Object.keys(rest).every((k) => k === 'date' || k === 'blockers');
        if (fresh && untouched) await repo.remove(b.date);
        else await repo.upsert(b.date, rest);
      },
    };
  },
};

/**
 * Allowlist of destinations. The password vault (`accounts`) is deliberately not reachable:
 * `targets.test.ts` pins that no adapter points at it.
 */
export const TARGETS = {
  todo: todos,
  event: calendar,
  reminder: reminders,
  bookmark: bookmarks,
  list: lists,
  finance,
  invoice: invoices,
  meal,
  workout,
  place,
  note: notes,
  subscription: subscriptions,
  birthday: people,
  plan,
  break: breaks,
};
