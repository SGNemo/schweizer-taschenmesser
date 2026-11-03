/**
 * Pure evaluations on top of `logic.ts`: sub-category roll-up, year view, comparison with the
 * previous period, the extended filter and the duplicate hint. No database, no clock.
 */
import { addMonthsToMonth, daysBetween, monthOf } from '@/core/time/dates';
import { categoryParts, isTransfer, monthSummary, type MonthSummary } from './logic';
import type { Category, Transaction } from './schema';

type Tx = Pick<Transaction, 'accountId' | 'categoryId' | 'kind' | 'amountMinor' | 'date'> &
  Partial<Pick<Transaction, 'transferId' | 'splits' | 'payee' | 'note'>>;

/* ---------- sub-categories ---------- */

type Cat = Pick<Category, 'name' | 'kind'> & { id: string; parentId?: string };

/** Ids of a category and its children (one level). */
export function categoryFamily(categories: readonly Cat[], id: string): Set<string> {
  const ids = new Set([id]);
  for (const c of categories) if (c.parentId === id) ids.add(c.id);
  return ids;
}

/** The id a category counts under in a roll-up: its parent, if the parent still exists. */
export function topCategoryId(categories: readonly Cat[], id: string | undefined): string | undefined {
  if (!id) return undefined;
  const c = categories.find((x) => x.id === id);
  if (!c) return undefined;
  return c.parentId && categories.some((p) => p.id === c.parentId) ? c.parentId : c.id;
}

export interface RolledTotal {
  categoryId?: string;
  amountMinor: number;
  /** Children of this top category with their own amounts (drill-down), largest first. */
  children: { categoryId: string; amountMinor: number }[];
}

/** Expenses of a month per top category, children folded in and listed below; transfers never count. */
export function rollupExpenses(
  txs: readonly Tx[],
  month: string,
  categories: readonly Cat[],
): RolledTotal[] {
  const tops = new Map<string | undefined, RolledTotal>();
  for (const t of txs) {
    if (t.kind !== 'expense' || monthOf(t.date) !== month || isTransfer(t)) continue;
    for (const part of categoryParts(t)) {
      const top = topCategoryId(categories, part.categoryId);
      const row = tops.get(top) ?? { categoryId: top, amountMinor: 0, children: [] };
      row.amountMinor += part.amountMinor;
      if (top && part.categoryId && part.categoryId !== top) {
        const child = row.children.find((c) => c.categoryId === part.categoryId);
        if (child) child.amountMinor += part.amountMinor;
        else row.children.push({ categoryId: part.categoryId, amountMinor: part.amountMinor });
      }
      tops.set(top, row);
    }
  }
  const rows = [...tops.values()];
  for (const r of rows) r.children.sort((a, b) => b.amountMinor - a.amountMinor);
  return rows.sort((a, b) => b.amountMinor - a.amountMinor);
}

/* ---------- comparison ---------- */

export interface Delta {
  /** current − previous, cents. */
  diffMinor: number;
  /** Whole percent of the previous value; undefined when there is nothing to compare with. */
  percent?: number;
}

export function delta(current: number, previous: number): Delta {
  const diffMinor = current - previous;
  if (previous === 0) return { diffMinor };
  return { diffMinor, percent: Math.round((diffMinor / Math.abs(previous)) * 100) };
}

export interface MonthComparison {
  income: Delta;
  expense: Delta;
  net: Delta;
}

export function compareMonths(txs: readonly Tx[], month: string): MonthComparison {
  const cur = monthSummary([...txs], month);
  const prev = monthSummary([...txs], addMonthsToMonth(month, -1));
  return {
    income: delta(cur.income, prev.income),
    expense: delta(cur.expense, prev.expense),
    net: delta(cur.net, prev.net),
  };
}

/** Per-category change against the previous month (top categories, in cents). */
export function categoryDeltas(
  txs: readonly Tx[],
  month: string,
  categories: readonly Cat[],
): Map<string | undefined, Delta> {
  const cur = rollupExpenses(txs, month, categories);
  const prev = new Map(
    rollupExpenses(txs, addMonthsToMonth(month, -1), categories).map((r) => [r.categoryId, r.amountMinor]),
  );
  return new Map(cur.map((r) => [r.categoryId, delta(r.amountMinor, prev.get(r.categoryId) ?? 0)]));
}

/* ---------- year ---------- */

export interface YearSummary {
  year: number;
  months: (MonthSummary & { month: string })[];
  income: number;
  expense: number;
  net: number;
  /** Whole percent of the income that was kept; undefined without income. */
  savingsRate?: number;
}

export function yearSummary(txs: readonly Tx[], year: number): YearSummary {
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, '0')}`;
    return { month, ...monthSummary([...txs], month) };
  });
  const income = months.reduce((s, m) => s + m.income, 0);
  const expense = months.reduce((s, m) => s + m.expense, 0);
  return {
    year,
    months,
    income,
    expense,
    net: income - expense,
    savingsRate: income > 0 ? Math.round(((income - expense) / income) * 100) : undefined,
  };
}

/** Expenses of a year per top category, largest first (for the year view). */
export function rollupYear(txs: readonly Tx[], year: number, categories: readonly Cat[]): RolledTotal[] {
  const all = Array.from({ length: 12 }, (_, i) =>
    rollupExpenses(txs, `${year}-${String(i + 1).padStart(2, '0')}`, categories),
  ).flat();
  const merged = new Map<string | undefined, RolledTotal>();
  for (const r of all) {
    const row = merged.get(r.categoryId) ?? { categoryId: r.categoryId, amountMinor: 0, children: [] };
    row.amountMinor += r.amountMinor;
    for (const c of r.children) {
      const hit = row.children.find((x) => x.categoryId === c.categoryId);
      if (hit) hit.amountMinor += c.amountMinor;
      else row.children.push({ ...c });
    }
    merged.set(r.categoryId, row);
  }
  return [...merged.values()].sort((a, b) => b.amountMinor - a.amountMinor);
}

/* ---------- filter ---------- */

export interface BookingFilter {
  accountId?: string;
  /** A category and its children. */
  categoryId?: string;
  kind?: 'expense' | 'income';
  /** Cents, inclusive. */
  minMinor?: number;
  maxMinor?: number;
  /** 'YYYY-MM-DD', inclusive. */
  from?: string;
  to?: string;
  /** Transfers are hidden unless this is true. */
  withTransfers?: boolean;
}

export function applyBookingFilter<T extends Tx>(
  txs: readonly T[],
  f: BookingFilter,
  categories: readonly Cat[],
): T[] {
  const family = f.categoryId ? categoryFamily(categories, f.categoryId) : undefined;
  return txs.filter((t) => {
    if (!f.withTransfers && isTransfer(t)) return false;
    if (f.accountId && t.accountId !== f.accountId) return false;
    if (f.kind && t.kind !== f.kind) return false;
    if (f.minMinor !== undefined && t.amountMinor < f.minMinor) return false;
    if (f.maxMinor !== undefined && t.amountMinor > f.maxMinor) return false;
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (family && !categoryParts(t).some((p) => p.categoryId && family.has(p.categoryId))) return false;
    return true;
  });
}

/* ---------- duplicates ---------- */

/**
 * A manual entry that looks like one already booked: same account, kind and amount, same payee
 * (ignoring case) and within `days` days. Only a hint; the user decides.
 */
export function findPossibleDuplicate<T extends Tx & { id: string }>(
  txs: readonly T[],
  draft: Pick<Tx, 'accountId' | 'kind' | 'amountMinor' | 'date' | 'payee'>,
  ignoreId?: string,
  days = 2,
): T | undefined {
  const payee = draft.payee?.trim().toLocaleLowerCase() ?? '';
  return txs.find(
    (t) =>
      t.id !== ignoreId &&
      !isTransfer(t) &&
      t.accountId === draft.accountId &&
      t.kind === draft.kind &&
      t.amountMinor === draft.amountMinor &&
      (t.payee?.trim().toLocaleLowerCase() ?? '') === payee &&
      Math.abs(daysBetween(t.date, draft.date)) <= days,
  );
}
