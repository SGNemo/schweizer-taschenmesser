/**
 * The arithmetic of budgets (pure, integer cents): what a period spent (children of a category
 * included), the carry-over, the status against a warning threshold, the forecast to the end of the
 * period and the plan of a savings goal.
 */
import { addMonthsStr, daysBetween } from '@/core/time/dates';
import type { Deposit, Goal } from './schema';

type Cat = { id: string; parentId?: string };

/** The category and its children (one level). */
export function familyOf(categories: readonly Cat[], categoryId: string): Set<string> {
  const ids = new Set([categoryId]);
  for (const c of categories) if (c.parentId === categoryId) ids.add(c.id);
  return ids;
}

/** Spending per category id of several months (each map: category id → cents) summed for a category and its children. */
export function spentInMonths(
  months: readonly (ReadonlyMap<string, number> | undefined)[],
  categories: readonly Cat[],
  categoryId: string,
): number {
  const family = familyOf(categories, categoryId);
  let sum = 0;
  for (const month of months)
    if (month) for (const [id, cents] of month) if (family.has(id)) sum += cents;
  return sum;
}

/**
 * What moves into the next period: the unspent amount (or the overspent one, negative) of the
 * previous period, never more than one limit either way. Only the period right before counts, so a
 * long past never builds up.
 */
export const carryIn = (limit: number, previousSpent: number): number =>
  Math.max(-limit, Math.min(limit, limit - previousSpent));

/** The limit that applies in the period: limit plus carry-over, never below 0. */
export const effectiveLimit = (limit: number, carry = 0): number => Math.max(0, limit + carry);

export type Tone = 'ok' | 'warn' | 'over';

export interface BudgetStatus {
  spent: number;
  limit: number;
  /** Negative when over budget. */
  remaining: number;
  pct: number;
  tone: Tone;
}

export const DEFAULT_WARN_PERCENT = 80;

/** "Over" beyond the limit, "warn" from `warnAt` percent (the exact percent counts), otherwise "ok". */
export function budgetStatus(
  limit: number,
  spent: number,
  warnAt: number = DEFAULT_WARN_PERCENT,
): BudgetStatus {
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : spent > 0 ? 100 : 0;
  return {
    spent,
    limit,
    remaining: limit - spent,
    pct,
    tone: spent > limit ? 'over' : limit > 0 && spent * 100 >= warnAt * limit ? 'warn' : 'ok',
  };
}

/**
 * Where the period ends up: the larger of the run rate so far (spent / days gone × days in the
 * period) and what is spent plus what is already planned (repeating bookings not yet booked), so a
 * planned rent is not counted twice. Only for the running period; a past period is what it spent.
 */
export function projectedSpend(input: {
  spent: number;
  planned: number;
  elapsed: number;
  total: number;
}): number {
  const { spent, planned, elapsed, total } = input;
  if (elapsed <= 0) return spent + planned;
  if (elapsed >= total) return spent;
  return Math.max(spent + planned, Math.round((spent / elapsed) * total));
}

export interface GoalProgress {
  saved: number;
  remaining: number;
  pct: number;
  reached: boolean;
  /** Amount to put aside per month to reach the goal by its deadline (cents), if there is one ahead. */
  perMonth?: number;
}

const DAYS_PER_MONTH = 30.4375;

export function goalProgress(
  goal: Pick<Goal, 'targetMinor' | 'deadline'>,
  deposits: readonly Pick<Deposit, 'amountMinor'>[],
  today: string,
): GoalProgress {
  const saved = deposits.reduce((sum, d) => sum + d.amountMinor, 0);
  const remaining = Math.max(0, goal.targetMinor - saved);
  const reached = saved >= goal.targetMinor;
  let perMonth: number | undefined;
  if (!reached && goal.deadline && goal.deadline >= today) {
    const months = Math.max(1, Math.ceil(daysBetween(today, goal.deadline) / DAYS_PER_MONTH));
    perMonth = Math.ceil(remaining / months);
  }
  return {
    saved,
    remaining,
    pct: Math.max(0, Math.min(100, Math.round((saved / goal.targetMinor) * 100))),
    reached,
    perMonth,
  };
}

export interface GoalPlan {
  /** Months until the goal is reached with the planned rate (rounded up). */
  months: number;
  /** The date the goal is reached ('YYYY-MM-DD', today plus the months). */
  reachedOn: string;
  /** Whole months the plan needs beyond the deadline (0 = in time, or no deadline). */
  monthsLate: number;
}

/** What the planned monthly rate means: when the goal is reached and whether that is before the deadline. */
export function goalPlan(
  goal: Pick<Goal, 'targetMinor' | 'deadline' | 'monthlyRateMinor'>,
  saved: number,
  today: string,
): GoalPlan | undefined {
  const rate = goal.monthlyRateMinor;
  if (!rate || rate < 1 || saved >= goal.targetMinor) return undefined;
  const months = Math.ceil((goal.targetMinor - saved) / rate);
  const reachedOn = addMonthsStr(today, months);
  // Late in whole months: the months the plan needs beyond the full months the deadline leaves.
  let monthsLate = 0;
  if (goal.deadline) {
    const allowed = Math.max(0, Math.floor(daysBetween(today, goal.deadline) / DAYS_PER_MONTH));
    monthsLate = Math.max(0, months - allowed);
  }
  return { months, reachedOn, monthsLate };
}
