import { addDaysStr, toEpoch } from '@/core/time/dates';
import { createRng } from './rng';
import type { SeedContext, SeedScale } from './types';

/** Global random seed of all test data. Changing it changes every seed (bump versions then). */
export const SEED_RANDOM = 42;

/** Context for one module: its own random stream, so adding a module never shifts the others. */
export function createSeedContext(args: {
  moduleId: string;
  today: string;
  scale: SeedScale;
}): SeedContext {
  return {
    rng: createRng(`${SEED_RANDOM}:${args.moduleId}`),
    today: args.today,
    scale: args.scale,
    day: (days) => addDaysStr(args.today, days),
    at: (days, time = '12:00') => toEpoch(addDaysStr(args.today, days), time),
    count: (by) => by[args.scale],
    id: (moduleId, collection, key) => `seed-${moduleId}-${collection}-${key}`,
  };
}
