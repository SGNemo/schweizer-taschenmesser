/**
 * The eight phase names, rule (ii) of CONCEPT-MOON §3 (ported from reference/astro/phaseName.js): a principal name only
 * on the local calendar day that holds its instant; every other day the in-between name from the elongation at the
 * local day's middle.
 */
import { moonPhase } from './core';
import type { PhaseInstant } from './phases';

export const PHASE_NAMES = [
  'new',
  'waxingCrescent',
  'firstQuarter',
  'waxingGibbous',
  'full',
  'waningGibbous',
  'lastQuarter',
  'waningCrescent',
] as const;
export type PhaseName = (typeof PHASE_NAMES)[number];

/** dayStartMs / dayEndMs: local midnight to the next (23 / 25 h on a clock change); principal covers the day. */
export function phaseNameForDay(
  dayStartMs: number,
  dayEndMs: number,
  principal: readonly PhaseInstant[],
): PhaseName {
  const hit = principal.find((p) => p.ms >= dayStartMs && p.ms < dayEndMs);
  if (hit) return PHASE_NAMES[hit.phase * 2]!;
  const e = moonPhase((dayStartMs + dayEndMs) / 2).elong;
  return PHASE_NAMES[e < 90 ? 1 : e < 180 ? 3 : e < 270 ? 5 : 7]!;
}
