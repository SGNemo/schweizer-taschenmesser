import { DEFAULT_CURRENCY, formatMoney } from '@/core/money';
import { addDaysStr, formatDay, nowTime } from '@/core/time/dates';
import { t } from '@/strings';
import type { CaptureFields } from '../parser';
import {
  CaptureError,
  type AmendContext,
  type BuildContext,
  type CaptureTarget,
  type OpenInvoice,
  type SavedCapture,
} from './types';

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
 * A payment reminder on its open invoice: writes exactly three things – the level + 1 (at most 3), the
 * day of the reminder and one appended note line – and never the amount or the due date (money changes
 * only in the editor). Noting the same reminder again does nothing. The undo removes only that line
 * and resets level and day only while they still hold what was written; it never removes the invoice.
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
  await repo.update(match.id, { dunningLevel: level, dunnedAt: day, note });
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
      if (Object.keys(patch).length > 0) await repo.update(match.id, patch);
    },
  };
}

/** Fitness (docs/features/fitness.md §5): a meal with rough kcal, a session with its exercises. */
const meal: CaptureTarget = {
  type: 'meal',
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

/** The planner's key of a thing from a module (`<moduleId>:<id>`): its item and its assignments carry it. */
export const planItemKey = (moduleId: string, id: string): string => `${moduleId}:${id}`;

/**
 * „p Steuer 2 Std bis Do“: a ToDo (through the `todo` target, so the backlog stays in ToDos) plus its
 * planner item `todos:<id>` with what only the planner holds – the pin of a plain day or the hard
 * due of a deadline word; „ab Do“ is the ToDo's own `startDate` (the planner reads it as earliest).
 */
const plan: CaptureTarget = {
  type: 'plan',
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
  meal,
  workout,
  note: notes,
  subscription: subscriptions,
  birthday: people,
  plan,
};
