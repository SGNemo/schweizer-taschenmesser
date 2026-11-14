/**
 * „Tage einteilen“ (use case „Wochenende retten“, package 2): the pure parts of the three-step sheet – the
 * lines of the dump (one line = one thing), what each line becomes (the planner field's reading, so a line
 * says the same here as in the field), the in-memory plan items of the preview, the time chips and the
 * device-local draft of the dump. Nothing here writes to the database.
 */
import type { PlanItem } from '@/core/plan/types';
import { now } from '@/core/time/now';
import type { CaptureFields } from '@/quickCapture/parser';
import { readField } from './dueWords';

/** The chips of step 2 in minutes: „keine Zeit · 2 h · 4 h · 6 h · ganzer Tag“ (TARGET F1). */
export const SETUP_CHIPS = [0, 120, 240, 360, 720] as const;

/** How many days the sheet lays out: today and the next two. */
export const SETUP_DAYS = 3;

/** One thing of the dump, read like a line of the planner field. */
export interface SetupThing {
  /** The key of its preview item (`new:<n>`); the stored ToDo gets its own id. */
  key: string;
  fields: CaptureFields;
  /** „bis So“ / „Frist …“: the planner item's hard deadline. */
  hardDue?: string;
}

/** The dump's lines without list markers and blanks (a pasted list „- Duschen“ reads as „Duschen“). */
export function setupLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•–·]|\d+[.)])\s+/u, '').trim())
    .filter(Boolean);
}

/** Each line as the planner field reads it (German phrases only in German, like the field). */
export function setupThings(text: string, today: string, de: boolean): SetupThing[] {
  const at = new Date(now());
  return setupLines(text).flatMap((line, i) => {
    const { fields, hardDue } = readField(line, at, today, de);
    if (!fields.title?.trim()) return [];
    return [{ key: `new:${i}`, fields, ...(hardDue ? { hardDue } : {}) }];
  });
}

/**
 * The things as plan items for the preview's dry run – what the ToDos source will report for them once
 * saved: the estimate, the priority, the date as a soft due (a hard one with a deadline phrase), the start
 * date as the earliest day. Newest last, so they never push an older thing aside on a tie.
 */
export function previewItems(things: readonly SetupThing[], at: number): PlanItem[] {
  return things.map((th, i) => {
    const f = th.fields;
    const due = th.hardDue ?? f.date;
    return {
      key: th.key,
      ...(f.estimateMin ? { durationMin: f.estimateMin } : {}),
      priority: (f.priority ?? 0) as PlanItem['priority'],
      ...(due ? { due: { date: due, hard: !!th.hardDue } } : {}),
      ...(f.startDate ? { earliest: f.startDate } : {}),
      splittable: true,
      createdAt: at + i,
    };
  });
}

/**
 * Does the sheet distribute anew? Only when one of its days gains time: a calm run never pulls a planned thing
 * onto a day that got time later (CONCEPT §3 rule 6), so a Sunday given 4 h would stay empty (W10). The preview
 * shows each move before anything is stored.
 */
export const gainsTime = (
  days: readonly { availableMin: number; date: string }[],
  chosen: Readonly<Record<string, number>>,
): boolean => days.some((d) => (chosen[d.date] ?? d.availableMin) > d.availableMin);

/** Key → title of the preview items (the preview names its rows by them). */
export const previewTitles = (things: readonly SetupThing[]): Record<string, string> =>
  Object.fromEntries(things.map((th) => [th.key, th.fields.title]));

/**
 * The dump, kept on this device only (never synced) while the sheet is closed before „Übernehmen“, so a
 * second look at the sheet starts where the person stopped. Gone after „Übernehmen“ or a day later.
 */
const DRAFT_KEY = 'tm-planner-days-draft';
const DRAFT_MAX_AGE_MS = 24 * 60 * 60_000;

const safe = <T>(fn: () => T): T | undefined => {
  try {
    return fn();
  } catch {
    return undefined; // storage blocked (private mode): the draft simply is not kept
  }
};

export function readSetupDraft(): string {
  const raw = safe(() => localStorage.getItem(DRAFT_KEY));
  if (!raw) return '';
  const parsed = safe(() => JSON.parse(raw) as { text?: unknown; at?: unknown });
  if (
    !parsed ||
    typeof parsed.text !== 'string' ||
    typeof parsed.at !== 'number' ||
    now() - parsed.at > DRAFT_MAX_AGE_MS
  ) {
    clearSetupDraft();
    return '';
  }
  return parsed.text;
}

export function writeSetupDraft(text: string): void {
  if (!text.trim()) return clearSetupDraft();
  safe(() => localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, at: now() })));
}

export function clearSetupDraft(): void {
  safe(() => localStorage.removeItem(DRAFT_KEY));
}
