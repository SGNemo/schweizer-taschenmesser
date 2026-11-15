/**
 * „Frist vorbei“ (planner hub R2, CONCEPT-DESIGN §4, D7): money whose hard deadline has passed leaves the days.
 * One rule for the run (the thing never reaches the engine, so it takes no day time and no sentence moves it) and
 * for the board (it is listed in its own group). A late chore – a ToDo, a routine – is not money: it stays on its
 * day with „Frist war Di“. Pure; never reads a clock.
 */
import type { PlannableEntry } from '@/core/modules/contributions';
import type { PlanItemRow } from './schema';

/** Kinds that are money deadlines: an open invoice, a cancellation date. */
const MONEY_KINDS: ReadonlySet<string> = new Set(['invoice', 'cancel']);

/**
 * The passed hard deadline of a money thing ('YYYY-MM-DD'), else `undefined`. The deadline is read as the run
 * reads it: one marked hard in the plan wins, else the source's.
 */
export function lateMoneyDue(
  entry: Pick<PlannableEntry, 'kind' | 'due' | 'done'>,
  row: Pick<PlanItemRow, 'due'> | undefined,
  today: string,
): string | undefined {
  if (entry.done || !MONEY_KINDS.has(entry.kind)) return undefined;
  const due = row?.due?.hard ? row.due : entry.due;
  return due?.hard && due.date < today ? due.date : undefined;
}
