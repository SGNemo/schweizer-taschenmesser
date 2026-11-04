import { useLiveQuery } from 'dexie-react-hooks';
import type { Stored } from '@/core/db/types';
import { currencyOf } from '@/core/money';
import { useModuleStates } from '@/core/modules/activation';
import { getSettings } from '@/core/settings/settings';
import { today as todayStr } from '@/core/time/dates';
// Sanctioned cross-module read access (see CLAUDE.md): finance/public only.
import {
  expensesByCategory,
  listExpenseCategories,
  plannedExpensesByCategory,
  type ExpenseCategory,
} from '@/modules/finance/public';
import {
  budgetStatus,
  carryIn,
  effectiveLimit,
  projectedSpend,
  spentInMonths,
  type BudgetStatus,
} from './compute';
import {
  elapsedIn,
  pastPeriodMonths,
  periodOf,
  previousPeriodMonth,
  type PeriodInfo,
} from './period';
import { budgetRepo } from './repo';
import type { Budget, BudgetPeriod } from './schema';
import { settings, settingsSchema } from './settings';

/** Month's spending per currency, then per category id (kept for callers that fetch it themselves). */
export type SpentByCurrency = Map<string, Map<string, number>>;

/** What was spent in the budget's category and currency (nothing is converted between currencies). */
export const spentOf = (spent: SpentByCurrency, budget: Pick<Budget, 'categoryId' | 'currency'>) =>
  spent.get(currencyOf(budget))?.get(budget.categoryId) ?? 0;

export interface BudgetRow {
  budget: Stored<Budget>;
  period: BudgetPeriod;
  info: PeriodInfo;
  /** Spent in the period, the category's children included. */
  spent: number;
  /** What moved in from the previous period (0 without carry-over). */
  carry: number;
  /** The limit that applies: the limit plus the carry-over. */
  limit: number;
  warnAt: number;
  status: BudgetStatus;
  /** Where the period ends at the pace so far; only for the running period and when the setting is on. */
  projected?: number;
  running: boolean;
}

export interface BudgetData {
  budgets: Stored<Budget>[];
  categories: ExpenseCategory[];
  rows: BudgetRow[];
}

/** Spending per category of one month and currency, fetched once per (currency, month). */
function monthCache() {
  const cache = new Map<string, Promise<Map<string, number>>>();
  return (month: string, currency: string) => {
    const key = `${currency}|${month}`;
    if (!cache.has(key)) cache.set(key, expensesByCategory(month, currency));
    return cache.get(key)!;
  };
}

/** Planned (not yet booked) repeating expenses, fetched once per (currency, range): one scan, not one per budget. */
function plannedCache() {
  const cache = new Map<string, Promise<Map<string, number>>>();
  return (from: string, to: string, currency: string) => {
    const key = `${currency}|${from}|${to}`;
    if (!cache.has(key)) cache.set(key, plannedExpensesByCategory(from, to, currency));
    return cache.get(key)!;
  };
}

/**
 * Budgets with what their period spent, the carry-over, the status against the warning threshold and
 * the forecast. `financeOn` false (the finance module is off) leaves the rows empty: there is no spending to show.
 */
export async function loadBudgetRows(
  month: string,
  day: string,
  financeOn: boolean,
): Promise<BudgetData> {
  const budgets = await budgetRepo.active().toArray();
  if (!financeOn) return { budgets, categories: [], rows: [] };
  // The categories are listed even without a budget: they are what a first budget is made for.
  const categories = await listExpenseCategories();
  if (budgets.length === 0) return { budgets, categories, rows: [] };
  const prefs = await getSettings('module.budgets', settingsSchema, settings.defaults as never);
  const spentIn = monthCache();
  const plannedIn = plannedCache();
  const rows: BudgetRow[] = [];
  for (const budget of budgets) {
    const currency = currencyOf(budget);
    const period = budget.period ?? 'month';
    const info = periodOf(month, period);
    const maps = await Promise.all(info.months.map((m) => spentIn(m, currency)));
    const spent = spentInMonths(maps, categories, budget.categoryId);
    let carry = 0;
    if (budget.carryOver) {
      const prev = periodOf(previousPeriodMonth(month, period), period);
      const prevMaps = await Promise.all(prev.months.map((m) => spentIn(m, currency)));
      carry = carryIn(
        budget.monthlyLimitMinor,
        spentInMonths(prevMaps, categories, budget.categoryId),
      );
    }
    const limit = effectiveLimit(budget.monthlyLimitMinor, carry);
    const warnAt = budget.warnAtPercent ?? prefs.warnAtPercent;
    const { total, elapsed, running } = elapsedIn(info, day);
    let projected: number | undefined;
    if (running && prefs.showForecast) {
      const planned = spentInMonths(
        [await plannedIn(day, info.to, currency)],
        categories,
        budget.categoryId,
      );
      projected = projectedSpend({ spent, planned, elapsed, total });
    }
    rows.push({
      budget,
      period,
      info,
      spent,
      carry,
      limit,
      warnAt,
      status: budgetStatus(limit, spent, warnAt),
      projected,
      running,
    });
  }
  return { budgets, categories, rows };
}

/** Budgets with the spending of the period that contains `month` (live). */
export function useBudgetData(month: string) {
  const states = useModuleStates();
  const financeOn = states?.finance;
  const day = todayStr();
  const data = useLiveQuery(
    () => loadBudgetRows(month, day, Boolean(financeOn)),
    [financeOn, month, day],
  );
  return { data, financeOn, loading: states === undefined };
}

export interface HistoryRow {
  /** A month inside the period (for the link to the bookings). */
  month: string;
  info: PeriodInfo;
  spent: number;
}

/** The last periods of one budget with what each spent, oldest first (the budget's editor shows them). */
export async function loadHistory(
  budget: Pick<Budget, 'categoryId' | 'currency' | 'period'>,
  month: string,
  categories: readonly ExpenseCategory[],
  count = 6,
): Promise<HistoryRow[]> {
  const period = budget.period ?? 'month';
  const currency = currencyOf(budget);
  const spentIn = monthCache();
  return Promise.all(
    pastPeriodMonths(month, period, count).map(async (m) => {
      const info = periodOf(m, period);
      const maps = await Promise.all(info.months.map((x) => spentIn(x, currency)));
      return { month: m, info, spent: spentInMonths(maps, categories, budget.categoryId) };
    }),
  );
}
