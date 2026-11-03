/**
 * "Vom Standard abweichend": a section's current values against its defaults. Pure comparison, so
 * the marker, the reset button that only shows when there is something to reset, and the tests
 * share one rule. Keys and defaults themselves never move (`pages/settings/inventory.test.ts`).
 */
import type { ResetPlan } from './reset';

function canonical(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );
}

/** Same value, whatever the key order inside objects. `undefined` equals only `undefined`. */
export function sameValue(a: unknown, b: unknown): boolean {
  return a === b || (a !== undefined && b !== undefined && canonical(a) === canonical(b));
}

/** Does the section differ from its defaults? A plan without `defaults` never reports a change. */
export async function isChanged(plan: ResetPlan): Promise<boolean> {
  if (!plan.defaults) return false;
  return !sameValue(await plan.capture(), plan.defaults());
}
