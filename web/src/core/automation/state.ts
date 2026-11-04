/** Guard state in memory, saved to `_meta` after a run (so a reload does not forget the limits). */
import type { TaschenmesserDB } from '@/core/db/db';
import { emptyGuard, pruneGuard, type GuardState } from './guards';
import { readKv, writeKv } from './kv';

const KEY = 'automation.guard';
let cache: { database: TaschenmesserDB; state: GuardState } | undefined;

export async function loadGuard(database: TaschenmesserDB): Promise<GuardState> {
  if (cache?.database === database) return cache.state;
  const stored = await readKv<GuardState>(database, KEY);
  const state = stored && stored.runs && stored.seen ? stored : emptyGuard();
  cache = { database, state };
  return state;
}

export async function saveGuard(
  database: TaschenmesserDB,
  state: GuardState,
  at: number,
): Promise<void> {
  const pruned = pruneGuard(state, at);
  cache = { database, state: pruned };
  await writeKv(database, KEY, pruned);
}

/** Tests only. */
export function resetGuardCache(): void {
  cache = undefined;
}
