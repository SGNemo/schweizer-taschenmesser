import { z } from 'zod';
import { useModuleStates, type ModuleStates } from '@/core/modules/activation';
import { useSettings } from '@/core/settings/settings';
import type { CaptureType, ParseOptions } from '../parser';
import { availableTypes } from '../targets';

/** `nutrition` of `module.fitness` (owner: `modules/fitness/settings.ts`), read as plain settings: no module import. */
const FITNESS_PREFS = z.looseObject({ nutrition: z.boolean().optional() });

/**
 * The capture types this device can save now, and the matching fitness flags for `parseCapture`:
 * `meal` disappears while Fitness' „Kalorien erfassen“ is off. One source for the capture form and the
 * live sample in Settings, so both read a sentence the same way.
 */
export function useCaptureTypes(): {
  /** The module states the list comes from (`undefined` while loading); callers use these, never a second query. */
  states: ModuleStates | undefined;
  available: CaptureType[];
  fitness: NonNullable<ParseOptions['fitness']>;
} {
  const states = useModuleStates();
  const [prefs] = useSettings('module.fitness', FITNESS_PREFS, {});
  const available = availableTypes(states).filter(
    (type) => type !== 'meal' || prefs?.nutrition !== false,
  );
  return {
    states,
    available,
    fitness: { meal: available.includes('meal'), workout: available.includes('workout') },
  };
}
