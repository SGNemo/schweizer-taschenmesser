/**
 * Accounting of model calls, per provider: one row per call that reached a provider (successful
 * or failed) plus one zero-token row per cache hit. The router reads it for its local limits
 * (requests per day, cost per month), the settings show it as statistics.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { now } from '@/core/time/now';
import type { Price } from './providers/presets';

export interface UsageRow {
  id?: number;
  at: number;
  /** Id of the provider entry (or `claude`/`ollama` in rows written before Phase 12). */
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheHit: boolean;
  /** Absent in older rows = `ok`. */
  outcome?: 'ok' | 'error';
  errorCode?: string;
  /** An earlier provider had failed; this one answered instead. */
  viaFallback?: boolean;
  /** USD, computed with the provider's price at the time of the call. */
  costUsd?: number;
}

export interface UsageTotals {
  /** Model calls that produced an answer (cache hits and failures excluded). */
  requests: number;
  cacheHits: number;
  errors: number;
  fallbacks: number;
  inputTokens: number;
  outputTokens: number;
  /** USD, only for calls with a known price; undefined when nothing is priced. */
  costUsd?: number;
}

/** USD per million tokens (input, output) for models we know when the provider has no price set. */
const PRICES: { match: RegExp; input: number; output: number }[] = [
  { match: /^claude-haiku-4-5/, input: 1, output: 5 },
];

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  price?: Price,
): number | undefined {
  const p = price
    ? { input: price.inputPerMTok, output: price.outputPerMTok }
    : PRICES.find((x) => x.match.test(model));
  return p ? (inputTokens * p.input + outputTokens * p.output) / 1_000_000 : undefined;
}

const table = (database: TaschenmesserDB) => database.table<UsageRow, number>('_aiUsage');

export async function recordUsage(
  row: Omit<UsageRow, 'id' | 'at'>,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await table(database).add({ ...row, at: now() });
}

const emptyTotals = (): UsageTotals => ({
  requests: 0,
  cacheHits: 0,
  errors: 0,
  fallbacks: 0,
  inputTokens: 0,
  outputTokens: 0,
});

function add(totals: UsageTotals, r: UsageRow): void {
  if (r.cacheHit) {
    totals.cacheHits += 1;
    return;
  }
  if (r.outcome === 'error') {
    totals.errors += 1;
    return;
  }
  totals.requests += 1;
  if (r.viaFallback) totals.fallbacks += 1;
  totals.inputTokens += r.inputTokens;
  totals.outputTokens += r.outputTokens;
  const cost = r.costUsd ?? estimateCostUsd(r.model, r.inputTokens, r.outputTokens);
  if (cost !== undefined) totals.costUsd = (totals.costUsd ?? 0) + cost;
}

export function totalsOf(rows: UsageRow[]): UsageTotals {
  const totals = emptyTotals();
  for (const r of rows) add(totals, r);
  return totals;
}

/** Statistics per provider id (cache hits are not attributed to a provider). */
export function totalsByProvider(rows: UsageRow[]): Map<string, UsageTotals> {
  const byProvider = new Map<string, UsageTotals>();
  for (const r of rows) {
    if (r.cacheHit) continue;
    const totals = byProvider.get(r.provider) ?? emptyTotals();
    add(totals, r);
    byProvider.set(r.provider, totals);
  }
  return byProvider;
}

export async function loadUsageTotals(database: TaschenmesserDB = defaultDb): Promise<UsageTotals> {
  return totalsOf(await table(database).toArray());
}

export const loadUsageRows = (database: TaschenmesserDB = defaultDb): Promise<UsageRow[]> =>
  table(database).toArray();

export const useUsageRows = (): UsageRow[] | undefined => useLiveQuery(() => loadUsageRows(), []);

export const resetUsage = (database: TaschenmesserDB = defaultDb): Promise<void> =>
  table(database).clear();

/* ---- windows used by the router's local limits ---- */

export const startOfDay = (at: number): number => {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
export const startOfMonth = (at: number): number => {
  const d = new Date(at);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** What a provider has used today / this month (calls that reached the provider, failed ones included). */
export async function usageWindow(
  providerId: string,
  at: number,
  database: TaschenmesserDB = defaultDb,
): Promise<{ requestsToday: number; costMonthUsd: number }> {
  const rows = await table(database).where('at').aboveOrEqual(startOfMonth(at)).toArray();
  const dayStart = startOfDay(at);
  let requestsToday = 0;
  let costMonthUsd = 0;
  for (const r of rows) {
    if (r.provider !== providerId || r.cacheHit) continue;
    if (r.at >= dayStart) requestsToday += 1;
    costMonthUsd += r.costUsd ?? 0;
  }
  return { requestsToday, costMonthUsd };
}
