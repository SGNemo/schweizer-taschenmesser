/**
 * The one line after a run (CONCEPT §1): „Eingeplant: Mo, Di · Blogpost jetzt Mi, Keller jetzt Mi ·
 * 1 mehr“ – at most two moves plus „n mehr“, under 68 characters, the undo comes from the toast itself.
 */
import { dayName } from '@/core/plan/explain';
import type { PlanResult } from '@/core/plan/types';
import { t } from '@/strings';

export const TOAST_MAX = 68;

export function runToast(
  result: Pick<PlanResult, 'diff'> | undefined,
  titleOf: (unitId: string) => string,
  lead: string,
): string {
  if (!result) return lead;
  const addedDays = [...new Set(result.diff.added.map((a) => a.to))].sort().map(dayName);
  const moves = result.diff.moved.map((m) => t.planner.toast.moved(titleOf(m.id), dayName(m.to)));
  const gone = result.diff.removed
    .filter((r) => r.reason !== 'done')
    .map((r) => t.planner.toast.waits(titleOf(r.id)));
  const changes = [...moves, ...gone];
  if (addedDays.length === 0 && changes.length === 0) return lead;
  const build = (shown: number): string => {
    const parts = [
      lead,
      ...(addedDays.length ? [t.planner.toast.planned(addedDays.join(', '))] : []),
      ...changes.slice(0, shown),
      ...(changes.length > shown ? [t.planner.toast.more(changes.length - shown)] : []),
    ];
    return parts.join(' · ');
  };
  for (let shown = Math.min(2, changes.length); shown >= 0; shown--) {
    const line = build(shown);
    if (line.length <= TOAST_MAX || shown === 0) return line;
  }
  return build(0);
}
