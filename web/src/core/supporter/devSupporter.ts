/**
 * Dev-Preview only: supporter status without a code. A dev build is "developer" by default so all
 * goodies are visible while building; the dev settings can simulate the other states (including
 * "none") to test the non-supporter view. Device-local (`_meta`), never synced.
 */
import { liveQuery } from 'dexie';
import { db } from '@/core/db/db';
import type { SupporterOverride } from './dev';

export const SIMULATE_KEY = 'supporter.simulate';
export const SIMULATIONS = ['default', 'none', 'kaffee', 'kuchen', 'developer'] as const;
export type Simulation = (typeof SIMULATIONS)[number];

const meta = () => db.table<{ key: string; value: unknown }, string>('_meta');

function parse(value: unknown): Simulation {
  return (SIMULATIONS as readonly unknown[]).includes(value) ? (value as Simulation) : 'default';
}

export function overrideOf(sim: Simulation): SupporterOverride {
  return sim === 'default' ? 'developer' : sim;
}

export async function setSimulation(sim: Simulation): Promise<void> {
  await meta().put({ key: SIMULATE_KEY, value: sim });
}

export function watchSimulation(next: (sim: Simulation) => void): () => void {
  const sub = liveQuery(async () => parse((await meta().get(SIMULATE_KEY))?.value)).subscribe({
    next,
    error: () => next('default'),
  });
  return () => sub.unsubscribe();
}
