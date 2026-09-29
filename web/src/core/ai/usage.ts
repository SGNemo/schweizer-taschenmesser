/** Token accounting: one row per model call, plus one (zero-token) row per cache hit. */
import { useLiveQuery } from 'dexie-react-hooks';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { now } from '@/core/time/now';

export interface UsageRow {
  id?: number;
  at: number;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheHit: boolean;
}

export interface UsageTotals {
  /** Model calls (cache hits excluded). */
  requests: number;
  cacheHits: number;
  inputTokens: number;
  outputTokens: number;
  /** USD, only for models with a known price; undefined when nothing is priced. */
  costUsd?: number;
}

/** USD per million tokens (input, output). Prices are an estimate; unknown models show none. */
const PRICES: { match: RegExp; input: number; output: number }[] = [
  { match: /^claude-haiku-4-5/, input: 1, output: 5 },
];

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | undefined {
  const price = PRICES.find((p) => p.match.test(model));
  return price ? (inputTokens * price.input + outputTokens * price.output) / 1_000_000 : undefined;
}

const table = (database: TaschenmesserDB) => database.table<UsageRow, number>('_aiUsage');

export async function recordUsage(
  row: Omit<UsageRow, 'id' | 'at'>,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await table(database).add({ ...row, at: now() });
}

export function totalsOf(rows: UsageRow[]): UsageTotals {
  const totals: UsageTotals = { requests: 0, cacheHits: 0, inputTokens: 0, outputTokens: 0 };
  for (const r of rows) {
    if (r.cacheHit) {
      totals.cacheHits += 1;
      continue;
    }
    totals.requests += 1;
    totals.inputTokens += r.inputTokens;
    totals.outputTokens += r.outputTokens;
    const cost = estimateCostUsd(r.model, r.inputTokens, r.outputTokens);
    if (cost !== undefined) totals.costUsd = (totals.costUsd ?? 0) + cost;
  }
  return totals;
}

export async function loadUsageTotals(database: TaschenmesserDB = defaultDb): Promise<UsageTotals> {
  return totalsOf(await table(database).toArray());
}

export const useUsageTotals = (): UsageTotals | undefined =>
  useLiveQuery(() => loadUsageTotals(), []);

export const resetUsage = (database: TaschenmesserDB = defaultDb): Promise<void> =>
  table(database).clear();
