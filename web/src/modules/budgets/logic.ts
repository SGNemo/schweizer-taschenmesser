import { daysBetween } from '@/core/time/dates';
import type { Deposit, Goal } from './schema';

export type Tone = 'ok' | 'warn' | 'over';

export interface BudgetStatus {
  spent: number;
  limit: number;
  /** Negative when over budget. */
  remaining: number;
  pct: number;
  tone: Tone;
}

/** Warn from 80 % of the limit, "over" beyond it. */
export function budgetStatus(limit: number, spent: number): BudgetStatus {
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  return {
    spent,
    limit,
    remaining: limit - spent,
    pct,
    tone: spent > limit ? 'over' : pct >= 80 ? 'warn' : 'ok',
  };
}

export interface GoalProgress {
  saved: number;
  remaining: number;
  pct: number;
  reached: boolean;
  /** Amount to put aside per month to reach the goal by its deadline (cents), if there is one ahead. */
  perMonth?: number;
}

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
    const months = Math.max(1, Math.ceil(daysBetween(today, goal.deadline) / 30.4375));
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
