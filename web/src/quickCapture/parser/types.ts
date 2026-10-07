/**
 * Public types of the quick-capture parser. This folder is pure TypeScript: it must not import
 * anything from outside `quickCapture/parser/` (guarded by `isolation.test.ts`).
 */

export type CaptureType = 'todo' | 'event' | 'reminder' | 'bookmark' | 'list' | 'finance' | 'note';

/** Same shape as the app's recurrence schema, declared locally to keep the parser dependency-free. */
export interface CaptureRecurrence {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  /** ISO weekdays, Mon = 1 … Sun = 7. */
  byWeekday?: number[];
  /** 1–31, or -1 for the last day of the month. */
  byMonthDay?: number;
}

export interface CaptureFields {
  title: string;
  /** 'YYYY-MM-DD', local calendar date. */
  date?: string;
  /** 'HH:mm', local wall clock. */
  time?: string;
  /** True for a date-only entry that is meant as a calendar event. */
  allDay?: boolean;
  recurrence?: CaptureRecurrence;
  /** Integer cents, always positive; `kind` gives the direction. */
  amountMinor?: number;
  kind?: 'expense' | 'income';
  url?: string;
  /** Effort in minutes; only set for ToDos ("Formular ausfüllen 15 min"). */
  estimateMin?: number;
  /** Free text kept alongside the entry (e.g. the body of shared text); never set by the parser. */
  note?: string;
}

/** Hints the UI can surface next to the chips; the parser never hides an assumption. */
export type CaptureNote =
  'assumed-date' | 'rolled-year' | 'past-date' | 'approx-time' | 'ambiguous-time';

export interface CaptureAlternative {
  type: CaptureType;
  /** 0..1 */
  confidence: number;
}

export interface CaptureResult {
  type: CaptureType;
  fields: CaptureFields;
  /** 0..1 confidence in `type`. */
  confidence: number;
  /** True when the UI must let the user choose instead of silently taking `type`. */
  needsChoice: boolean;
  /** True when a shortcut prefix (`t `, `k `, …) fixed the type. */
  forced: boolean;
  alternatives: CaptureAlternative[];
  notes: CaptureNote[];
}

export interface ParseOptions {
  /** Reference "now" (local time). Never read from the system clock inside the parser. */
  now: Date;
  /** Type used for plain text without any signal. Defaults to `todo`. */
  defaultType?: CaptureType;
}
