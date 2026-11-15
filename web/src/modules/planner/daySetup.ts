/**
 * „Tage einteilen“ (use case „Wochenende retten“, package 2): the pure parts of the three-step sheet – the
 * lines of the dump (one line = one thing), what each line becomes (the quick capture's reading of a line,
 * `readLine`, so a line says the same here as in a many-lines capture), the in-memory plan items of the
 * preview, the time chips and the device-local draft of the dump. Nothing here writes to the database.
 */
import type { PlanOp } from '@/core/plan/instructions';
import type { PlanItem } from '@/core/plan/types';
import { now } from '@/core/time/now';
import type { CaptureFields, CaptureType } from '@/quickCapture/parser';
import { breakOf } from '@/quickCapture/targets';
import { isReminder, readLine, reminderRow, type LineReadOptions } from '@/quickCapture/ui/batch';

/** The chips of step 2 in minutes: „keine Zeit · 2 h · 4 h · 6 h · ganzer Tag“ (TARGET F1). */
export const SETUP_CHIPS = [0, 120, 240, 360, 720] as const;

/** How many days the sheet lays out: today and the next two. */
export const SETUP_DAYS = 3;

/** One thing of the dump, read like a line of a many-lines quick capture. */
export interface SetupThing {
  /** The key of its preview item (`new:<n>`); the stored ToDo gets its own id. */
  key: string;
  /**
   * Where the line goes, as the quick capture decides it: a ToDo, a Termin, a reminder (`once`), a break
   * („Pause 2 Std Zocken“: a blocker of its day, never a ToDo) …
   */
  type: CaptureType;
  fields: CaptureFields;
  /** „bis So“: the ToDo's deadline, the planner item's hard due. */
  hardDue?: string;
  /** „bis So 18:00“: the deadline's hour ('HH:mm', package 5b). */
  hardDueTime?: string;
}

/** What the sheet reads lines with: the capture's targets on this device (`useCaptureTypes`). */
export type SetupRead = Pick<LineReadOptions, 'available' | 'fitness' | 'place' | 'breaks'>;

/** The dump's lines without list markers and blanks (a pasted list „- Duschen“ reads as „Duschen“). */
export function setupLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•–·]|\d+[.)])\s+/u, '').trim())
    .filter(Boolean);
}

/**
 * Each line as a many-lines quick capture reads it (`readLine`, W23): „So 19 Uhr erinnere mich: …“ is a
 * reminder on Sunday, „Mo 7:30 …“ a Termin on Monday, „… bis So 18:00“ a ToDo with its deadline and hour,
 * „Pause …“ a break – each on the day it names. The sheet asks nothing: an unclear line is a ToDo as typed
 * (the planner's own default, whatever the capture's default target is), a money line a ToDo with its amount
 * (a batch never books), a payment reminder the ToDo „Mahnung … prüfen“ (no invoice lookup here).
 */
export function setupThings(text: string, read: SetupRead): SetupThing[] {
  return setupLines(text).flatMap((line, i) => {
    const row = readLine(line, { ...read, defaultType: 'todo', noQuestion: true });
    const plan = isReminder(row.type, row.fields)
      ? reminderRow(row.type, row.fields, 'failed', read.available)
      : row;
    const type = plan.type ?? 'todo';
    const fields = plan.fields;
    if (!fields.title?.trim()) return [];
    const hardDue = type === 'todo' && fields.deadline ? fields.date : undefined;
    return [
      {
        key: `new:${i}`,
        type,
        fields,
        ...(hardDue ? { hardDue } : {}),
        ...(hardDue && fields.time ? { hardDueTime: fields.time } : {}),
      },
    ];
  });
}

/** The things the plan takes as items: the ToDos (a Termin, a reminder or a break is no thing to distribute). */
export const setupTasks = (things: readonly SetupThing[]): SetupThing[] =>
  things.filter((th) => th.type === 'todo');

/**
 * The things as plan items for the preview's dry run – what the ToDos source will report for them once
 * saved: the estimate, the priority, the date as a soft due (a hard one with a deadline phrase), the start
 * date as the earliest day. Newest last, so they never push an older thing aside on a tie. A break is no item
 * (`breakOps` blocks its day).
 */
export function previewItems(things: readonly SetupThing[], at: number): PlanItem[] {
  return setupTasks(things).map((th, i) => {
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
 * The breaks of the dump as `block` ops of the preview's dry run (only date, length and label count there; the
 * times stay empty when none were typed). Their own sentence is the one the stored break's toast says.
 */
export function breakOps(
  things: readonly SetupThing[],
  today: string,
): Extract<PlanOp, { op: 'block' }>[] {
  return things
    .filter((th) => th.type === 'break')
    .map((th) => {
      const b = breakOf(th.fields, { today });
      return {
        op: 'block' as const,
        date: b.date,
        label: b.label,
        min: b.min,
        from: b.from ?? '',
        to: b.to ?? '',
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

/**
 * C6 (CHECK-1-3): the day's appointments already take the chosen time – step 2 says so in one calm line (the chips
 * stay as they are: time with appointments counted, as on the board).
 */
export const eventsFill = (
  day: { blockers: readonly { min: number; calendar: boolean }[] },
  min: number,
): boolean => {
  const events = day.blockers.filter((b) => b.calendar).reduce((sum, b) => sum + b.min, 0);
  return min > 0 && events >= min;
};

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
