import { DEFAULT_CURRENCY } from '@/core/money';
import { addDaysStr } from '@/core/time/dates';
import { t } from '@/strings';
import type { CaptureFields } from '../parser';
import { CaptureError, type BuildContext, type CaptureTarget } from './types';

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
  moduleId: 'todos',
  collection: 'task',
  // `listId` comes from the module's `aiCreateDefaults` (the inbox list).
  build: (f) => ({
    title: title(f),
    ...(f.date ? { dueDate: date(f.date) } : {}),
    ...(f.startDate ? { startDate: date(f.startDate) } : {}),
    ...(f.estimateMin ? { estimateMin: f.estimateMin } : {}),
    ...(f.priority ? { priority: f.priority } : {}),
    ...noteOf(f.time ? t.quickCapture.todoTimeNote(f.time) : undefined, f.note),
    ...(f.link ? { links: [f.link] } : {}),
  }),
};

const calendar: CaptureTarget = {
  type: 'event',
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
  // A reminder is a calendar event of the kind "reminder" that notifies at its time (since 0.7.0).
  moduleId: 'calendar',
  collection: 'event',
  build: (f, ctx) => ({
    title: title(f),
    kind: 'reminder',
    allDay: false,
    startDate: date(f.date ?? ctx.today),
    startTime: f.time ?? '09:00',
    notify: { minutesBefore: 0, enabled: true },
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

const bookmarks: CaptureTarget = {
  type: 'bookmark',
  moduleId: 'bookmarks',
  collection: 'item',
  // Direct write: the module's dedupe service (`bookmark.requested`) only runs in the main window.
  build: (f) => {
    const url = httpUrl(f.url);
    const name = f.title.trim() || (url ? new URL(url).hostname : '');
    if (!name) throw new CaptureError('invalid');
    return {
      title: name,
      kind: 'link',
      ...(url ? { url } : {}),
    };
  },
};

/** The text becomes an entry of the shopping list as typed ("2 Milch"); `listId` comes from the module's `aiCreateDefaults`. */
const lists: CaptureTarget = {
  type: 'list',
  moduleId: 'lists',
  collection: 'item',
  build: (f) => ({ name: title(f), done: false }),
};

const finance: CaptureTarget = {
  type: 'finance',
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
      ...noteOf(f.note),
    };
  },
};

const subscriptions: CaptureTarget = {
  type: 'subscription',
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
  moduleId: 'notes',
  collection: 'note',
  build: (f) => {
    const body = [f.note, f.url].filter(Boolean).join('\n');
    if (!f.title.trim() && !body) throw new CaptureError('invalid');
    return { title: f.title.trim(), body };
  },
};

/**
 * „p Steuer 2 Std bis Do“: a ToDo (through the `todo` target, so the backlog stays in ToDos) plus its
 * planner item `todos:<id>` with what only the planner holds – the pin of a plain day or the hard
 * due of a deadline word; „ab Do“ is the ToDo's own `startDate` (the planner reads it as earliest).
 */
const plan: CaptureTarget = {
  type: 'plan',
  moduleId: 'planner',
  collection: 'item',
  via: { type: 'todo', id: (first) => `${first.moduleId}:${first.id}` },
  build: (f, ctx, first) => {
    // The checks of the first stage (a title, real dates) hold for the plan entry too.
    todos.build(f, ctx);
    const pinned = date(f.pin);
    return {
      source: { module: first?.moduleId ?? 'todos', id: first?.id ?? 'new' },
      order: 0,
      ...(pinned ? { pinned } : {}),
      ...(f.hardDue && f.date ? { due: { date: date(f.date), hard: true } } : {}),
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
  note: notes,
  subscription: subscriptions,
  birthday: people,
  plan,
};
