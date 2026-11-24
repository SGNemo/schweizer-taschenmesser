// Named moon phases, recommended rule (ii): a principal name (new, first quarter, full, last quarter)
// only on the local calendar day that contains the phase instant; otherwise the in-between name
// from the elongation at local noon. Needs: the day's bounds in local time, the principal instants (L4).
import { moonPhase } from './core.js';

export const NAMES = ['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent'];

/**
 * dayStartMs/dayEndMs: local midnight .. next local midnight (UTC ms; 23/25 h on DST days).
 * principal: [{ms, phase: 0..3}] covering at least this day (from phasesBetween()).
 */
export function phaseNameForDay(dayStartMs, dayEndMs, principal) {
  const hit = principal.find((p) => p.ms >= dayStartMs && p.ms < dayEndMs);
  if (hit) return NAMES[hit.phase * 2];
  const e = moonPhase((dayStartMs + dayEndMs) / 2).elong; // local noon (approx.)
  return NAMES[e < 90 ? 1 : e < 180 ? 3 : e < 270 ? 5 : 7];
}

/** Name for an instant (e.g. "now" on the home screen): same rule, using the instant's local day. */
export const phaseNameAt = (ms, dayStartMs, dayEndMs, principal) => phaseNameForDay(dayStartMs, dayEndMs, principal);
