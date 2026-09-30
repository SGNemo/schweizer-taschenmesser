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

const todos: CaptureTarget = {
  type: 'todo',
  moduleId: 'todos',
  collection: 'task',
  // `listId` comes from the module's `aiCreateDefaults` (the inbox list).
  build: (f) => ({
    title: title(f),
    ...(f.date ? { dueDate: date(f.date) } : {}),
    ...(f.time ? { note: t.quickCapture.todoTimeNote(f.time) } : {}),
  }),
};

const calendar: CaptureTarget = {
  type: 'event',
  moduleId: 'calendar',
  collection: 'event',
  build: (f, ctx: BuildContext) => ({
    title: title(f),
    startDate: date(f.date ?? ctx.today),
    allDay: !f.time,
    ...(f.time ? { startTime: f.time } : {}),
    ...(f.recurrence ? { recurrence: f.recurrence } : {}),
  }),
};

const reminders: CaptureTarget = {
  type: 'reminder',
  moduleId: 'reminders',
  collection: 'reminder',
  build: (f, ctx) => ({
    title: title(f),
    startDate: date(f.date ?? ctx.today),
    ...(f.time ? { time: f.time } : {}),
    ...(f.recurrence ? { recurrence: f.recurrence } : {}),
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

const finance: CaptureTarget = {
  type: 'finance',
  moduleId: 'finance',
  collection: 'transaction',
  requiresConfirm: true,
  // `accountId` comes from the module's `aiCreateDefaults` (the primary account).
  build: (f, ctx) => {
    if (!f.amountMinor || f.amountMinor < 1) throw new CaptureError('invalid');
    return {
      kind: f.kind ?? 'expense',
      amountMinor: f.amountMinor,
      date: date(f.date ?? ctx.today),
      ...(f.title.trim() ? { payee: f.title.trim() } : {}),
    };
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
 * Allowlist of destinations. The password vault (`accounts`) is deliberately not reachable:
 * `targets.test.ts` pins that no adapter points at it.
 */
export const TARGETS = {
  todo: todos,
  event: calendar,
  reminder: reminders,
  bookmark: bookmarks,
  finance,
  note: notes,
};
