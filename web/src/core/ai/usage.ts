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
  /** Which stage produced the answer; absent in older rows (model calls and cache hits). */
  stage?: 'rule' | 'local' | 'cloud' | 'cache';
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

/** Rule and local-model answers cost nothing and are not model calls of a provider. */
const isFree = (r: UsageRow): boolean => r.stage === 'rule' || r.stage === 'local';

function add(totals: UsageTotals, r: UsageRow): void {
  if (isFree(r)) return;
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
    if (r.cacheHit || isFree(r)) continue;
    const totals = byProvider.get(r.provider) ?? emptyTotals();
    add(totals, r);
    byProvider.set(r.provider, totals);
  }
  return byProvider;
}

export type StageName = 'rule' | 'local' | 'cloud' | 'cache';

export interface StageTotals {
  /** Answers produced by the stage. */
  answers: number;
  inputTokens: number;
  outputTokens: number;
  /** USD, only cloud answers with a known price. */
  costUsd: number;
}

const emptyStage = (): StageTotals => ({ answers: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });

/** Which stage answered: rows without `stage` are cache hits or cloud model calls. */
const stageOf = (r: UsageRow): StageName => r.stage ?? (r.cacheHit ? 'cache' : 'cloud');

/** Answers per stage (failed provider attempts are not answers). */
export function totalsByStage(rows: UsageRow[]): Record<StageName, StageTotals> {
  const out: Record<StageName, StageTotals> = {
    rule: emptyStage(),
    local: emptyStage(),
    cloud: emptyStage(),
    cache: emptyStage(),
  };
  for (const r of rows) {
    if (r.outcome === 'error') continue;
    const s = out[stageOf(r)];
    s.answers += 1;
    s.inputTokens += r.inputTokens;
    s.outputTokens += r.outputTokens;
    if (stageOf(r) === 'cloud') {
      s.costUsd += r.costUsd ?? estimateCostUsd(r.model, r.inputTokens, r.outputTokens) ?? 0;
    }
  }
  return out;
}

/** Per local calendar day (YYYY-MM-DD), newest first: answers per stage, tokens, cost. */
export function dailyByStage(
  rows: UsageRow[],
): { day: string; stages: Record<StageName, StageTotals> }[] {
  const byDay = new Map<string, UsageRow[]>();
  for (const r of rows) {
    const d = new Date(r.at);
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    byDay.set(day, [...(byDay.get(day) ?? []), r]);
  }
  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, list]) => ({ day, stages: totalsByStage(list) }));
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
