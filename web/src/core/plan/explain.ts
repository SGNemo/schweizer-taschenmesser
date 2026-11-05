/**
 * Rule 8: every reason has one calm sentence with day names („muss bis Do fertig sein“, „weiter von
 * Di“, „Platz nahmen Steuerbescheid, Steuer · Teil 2/2“). Texts come from `t.planner.reasons`, day
 * names from the UI language; `nameOf` turns a unit id into its title (the engine knows no titles).
 */
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import type { Assignment, PlanDiff, Unplaced } from './types';

/** Short weekday of a date in the UI language, without a trailing period („Do“, „Thu“, „jeu“). */
export const dayName = (date: string): string => formatDay(date, 'EEE').replace(/\.$/, '');

export type NameOf = (unitId: string) => string;

/** The sentence behind „Warum hier?“ of a placed unit. */
export function explainAssignment(
  a: Pick<Assignment, 'reason' | 'bumpedBy'>,
  ctx: { due?: string; prevDate?: string; nameOf: NameOf },
): string {
  const r = t.planner.reasons;
  switch (a.reason) {
    case 'pinned':
      return r.pinned;
    case 'deadline':
      return ctx.due ? r.deadline(dayName(ctx.due)) : r.new;
    case 'deadline-buffer':
      return ctx.due ? r['deadline-buffer'](dayName(ctx.due)) : r.new;
    case 'new':
      return r.new;
    case 'kept':
      return r.kept;
    case 'carried':
      return ctx.prevDate ? r.carried(dayName(ctx.prevDate)) : r.carriedEarlier;
    case 'bumped':
      return r.bumped(a.bumpedBy?.length ? a.bumpedBy.map(ctx.nameOf).join(', ') : r.others);
    case 'after-part':
      return r['after-part'](a.bumpedBy?.[0] ? ctx.nameOf(a.bumpedBy[0]) : r.others);
    case 'pulled':
      return ctx.due ? r.pulled(dayName(ctx.due)) : r.kept;
    case 'capacity':
      return r.capacity;
  }
}

/** Why a unit waits („Wartet auf freie Zeit“). */
export function explainWait(u: Pick<Unplaced, 'reason' | 'bumpedBy'>, nameOf: NameOf): string {
  if (u.bumpedBy?.length) return t.planner.reasons.bumped(u.bumpedBy.map(nameOf).join(', '));
  return t.planner.wait[u.reason];
}

/** The cause of a move or drop-out in the diff. */
export function explainMove(
  m: Pick<PlanDiff['moved'][number], 'reason' | 'by'> & { from?: string },
  nameOf: NameOf,
): string {
  const r = t.planner.reasons;
  switch (m.reason) {
    case 'carried':
      return m.from ? r.carried(dayName(m.from)) : r.carriedEarlier;
    case 'bumped':
      return r.bumped(m.by?.length ? m.by.map(nameOf).join(', ') : r.others);
    case 'after-part':
      return r['after-part'](m.by?.[0] ? nameOf(m.by[0]) : r.others);
    case 'capacity':
      return r.capacity;
    case 'pulled':
      return r.pulled('');
    case 'done':
      return r.done;
  }
}
