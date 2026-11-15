import { useLiveQuery } from 'dexie-react-hooks';
import type { Stored } from '@/core/db/types';
import { currencyOf, DEFAULT_CURRENCY } from '@/core/money';
import { useModuleStates } from '@/core/modules/activation';
import { getSettings } from '@/core/settings/settings';
import { addMonthsToMonth, today as todayStr } from '@/core/time/dates';
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
  familyOf,
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
import { monthlyShare, rollUp } from './insights';
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

/** The currency the head and the charts speak in: euro when a budget uses it, else the first budget's. */
export function mainCurrencyOf(budgets: readonly Pick<Budget, 'currency'>[]): string | undefined {
  if (budgets.some((b) => currencyOf(b) === DEFAULT_CURRENCY)) return DEFAULT_CURRENCY;
  return budgets[0] && currencyOf(budgets[0]);
}

export interface BudgetInsights {
  /** The viewed month the figures belong to (a live query keeps its last result while the month changes). */
  month: string;
  currency: string;
  /** 'YYYY-MM' of the trend, oldest first; the last one is the viewed month. */
  months: string[];
  /** Spent per month in the budgets' categories (children included), same order as `months`. */
  spentPerMonth: number[];
  /** Per month: any expense at all in `currency` (a month before the first booking draws a gap, not a 0). */
  hasSpending: boolean[];
  /** The budgets' limits as an amount per month (quarter a third, year a twelfth). */
  plannedPerMonth: number;
  /** Every expense of the viewed month per top-level category id ('' = no category), largest first. */
  shares: { id: string; value: number }[];
  /** All expenses of the viewed month in `currency`. */
  monthTotal: number;
}

/**
 * What the charts above the budget cards draw: the trend of the last `count` months (spending in the
 * budgeted categories against the limits per month) and where all of the viewed month's money went.
 * Only budgets and accounts in `currency` count (nothing is converted).
 */
export async function loadInsights(
  month: string,
  budgets: readonly Pick<Budget, 'categoryId' | 'currency' | 'period' | 'monthlyLimitMinor'>[],
  categories: readonly ExpenseCategory[],
  currency: string,
  count = 6,
): Promise<BudgetInsights> {
  const own = budgets.filter((b) => currencyOf(b) === currency);
  const months = Array.from({ length: count }, (_, i) => addMonthsToMonth(month, i - count + 1));
  const maps = await Promise.all(months.map((m) => expensesByCategory(m, currency)));
  // One set over every budget's category family: a child with its own limit under a parent with one is counted once.
  const budgeted = new Set(own.flatMap((b) => [...familyOf(categories, b.categoryId)]));
  const spentPerMonth = maps.map((map) => {
    let sum = 0;
    for (const [id, cents] of map) if (budgeted.has(id)) sum += cents;
    return sum;
  });
  const plannedPerMonth = own.reduce(
    (sum, b) => sum + monthlyShare(b.monthlyLimitMinor, b.period ?? 'month'),
    0,
  );
  const viewed = rollUp(maps[maps.length - 1] ?? new Map(), categories);
  const shares = [...viewed]
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => b.value - a.value);
  const monthTotal = shares.reduce((sum, s) => sum + s.value, 0);
  const hasSpending = maps.map((map) => [...map.values()].some((v) => v > 0));
  return {
    month,
    currency,
    months,
    spentPerMonth,
    hasSpending,
    plannedPerMonth,
    shares,
    monthTotal,
  };
}

/**
 * The chart figures for `month` (live), once the budget rows are there; none without budgets or while
 * `enabled` is false (charts switched off, a small widget). Keyed on what the figures depend on, not on the
 * `data` object, which is new on every emission: the live query tracks the bookings itself.
 */
export function useBudgetInsights(month: string, data: BudgetData | undefined, enabled = true) {
  const key = data
    ? JSON.stringify([
        data.budgets.map((b) => [b.id, b.categoryId, b.currency, b.period, b.monthlyLimitMinor]),
        data.categories.map((c) => [c.id, c.parentId]),
        data.rows.length,
      ])
    : '';
  return useLiveQuery(async () => {
    const currency = data && mainCurrencyOf(data.budgets);
    if (!enabled || !data || !currency || data.rows.length === 0) return null;
    return loadInsights(month, data.budgets, data.categories, currency);
    // `data` is read through `key` (same key = same figures).
  }, [month, key, enabled]);
}
