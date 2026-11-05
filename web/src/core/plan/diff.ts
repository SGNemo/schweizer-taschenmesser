import type { Assignment, MoveReason, PlanDiff, PrevAssignment } from './types';

/** Why a unit lost the day it had: who took the room (`by`), or the part it follows. */
export interface Bump {
  id: string;
  date: string;
  by: string[];
  cause: 'bumped' | 'capacity' | 'after-part';
}

/**
 * Rule 8 (diff part): every move and drop-out names its cause. A unit that was placed before and is
 * gone now was `done` (no unit any more) or lost its room (`capacity`, or `bumped` by the named ones).
 */
export function diffPlans(
  prev: readonly PrevAssignment[],
  assignments: readonly Assignment[],
  bumps: readonly Bump[],
  liveUnits: ReadonlySet<string>,
): PlanDiff {
  const prevByUnit = new Map(prev.map((a) => [a.id, a]));
  const placed = new Set(assignments.map((a) => a.id));
  const diff: PlanDiff = { added: [], moved: [], removed: [], unchanged: 0 };
  for (const a of assignments) {
    const p = prevByUnit.get(a.id);
    if (!p) diff.added.push({ id: a.id, to: a.date, reason: a.reason });
    else if (p.date === a.date) diff.unchanged++;
    else {
      const b = bumps.find((x) => x.id === a.id);
      const reason: MoveReason = b?.cause ?? (a.date < p.date ? 'pulled' : 'carried');
      diff.moved.push({ id: a.id, from: p.date, to: a.date, reason, ...(b?.by.length ? { by: b.by } : {}) });
    }
  }
  for (const p of prev) {
    if (placed.has(p.id)) continue;
    const b = bumps.find((x) => x.id === p.id);
    const reason: MoveReason = liveUnits.has(p.id) ? (b?.cause ?? 'capacity') : 'done';
    diff.removed.push({ id: p.id, from: p.date, reason, ...(b?.by.length ? { by: b.by } : {}) });
  }
  return diff;
}
