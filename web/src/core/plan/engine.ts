/**
 * The planning engine (CONCEPT §3): items + days → assignments, in a fixed order of rules per day
 * (capacity → pinned → hard due inside the horizon → priority with kept over carried over new), an
 * honest list of what waits, a diff against the previous plan and the load per day. Pure and
 * deterministic: same input, same output; no clock, no randomness, no I/O.
 */
import { capacity } from './capacity';
import { addDays, cmp } from './dates';
import { diffPlans, type Bump } from './diff';
import {
  DEFAULT_PLAN_SETTINGS,
  MAIN_THRESHOLD_MIN,
  type Assignment,
  type DayLoad,
  type PlanDay,
  type PlanInput,
  type PlanResult,
  type PlanSettings,
  type PlanUnit,
  type PrevAssignment,
  type Unplaced,
} from './types';
import { toUnits, unitId } from './units';

/**
 * The last day a unit may start so that it and the remaining sessions of its item (one per day)
 * still meet a hard due. Counts only days that have room (a free Thursday does not count), on the raw
 * free time: a deadline may eat the buffer. `undefined` = no pressure: no hard due, or a due beyond
 * the horizon (far invoices must not be forced onto the last day and move on every run).
 */
export function latestStart(
  u: PlanUnit,
  horizon: readonly PlanDay[],
  settings: PlanSettings,
): string | undefined {
  if (!u.item.due?.hard) return undefined;
  const last = horizon.at(-1);
  if (!last || u.item.due.date > last.date) return undefined;
  const first = horizon[0]!.date;
  const room = (date: string): boolean => {
    const d = horizon.find((x) => x.date === date);
    return d ? capacity(d, settings).raw >= u.minutes : false;
  };
  let cursor = u.item.due.date;
  for (let j = u.of - 1; j >= u.k; j--) {
    let d = cursor;
    while (d >= first && !room(d)) d = addDays(d, -1);
    if (j === u.k) return d; // may lie before today: then it is "now or late"
    cursor = addDays(d, -1);
  }
  return cursor;
}

const tierOfReason = (reason: string): number =>
  reason === 'pinned' ? 0 : reason.startsWith('deadline') ? 1 : 2;

export function plan(input: PlanInput): PlanResult {
  const s: PlanSettings = { ...DEFAULT_PLAN_SETTINGS, ...input.settings };
  const today = input.today;
  const last = addDays(today, s.horizonDays - 1);
  const horizon = input.days
    .filter((d) => d.date >= today && d.date <= last)
    .sort((a, b) => cmp(a.date, b.date));
  const prev: readonly PrevAssignment[] = input.prev ?? [];
  const prevByUnit = new Map(prev.map((a) => [a.id, a]));
  const units = input.items.filter((i) => !i.done && !i.excluded).flatMap((i) => toUnits(i, s));
  const unitById = new Map(units.map((u) => [u.id, u]));
  const placed = new Map<string, Assignment>();
  const assignments: Assignment[] = [];
  const load: Record<string, DayLoad> = {};
  const bumps: Bump[] = [];
  const isMain = (u: PlanUnit): boolean => u.minutes >= MAIN_THRESHOLD_MIN;
  /** 2 = was planned for this day (kept), 1 = planned for an earlier day (carried), 0 = new. */
  const sticky = (u: PlanUnit, date: string): number => {
    const p = prevByUnit.get(u.id);
    return !p || p.date > date ? 0 : p.date === date ? 2 : 1;
  };

  for (const day of horizon) {
    const cap = capacity(day, s);
    let left = cap.usable;
    let rawLeft = cap.raw;
    let mains = 0;
    const todayList: Assignment[] = [];
    const put = (u: PlanUnit, reason: Assignment['reason'], bumpedBy?: string[]): void => {
      const p = prevByUnit.get(u.id);
      // A unit that keeps its day keeps its stored cause as well.
      const by = bumpedBy ?? (p && p.date === day.date ? p.bumpedBy : undefined);
      const a: Assignment = {
        id: u.id,
        itemKey: u.itemKey,
        k: u.k,
        of: u.of,
        date: day.date,
        minutes: u.minutes,
        order: todayList.length,
        reason,
        ...(by && by.length > 0 ? { bumpedBy: by } : {}),
      };
      placed.set(u.id, a);
      assignments.push(a);
      todayList.push(a);
      left -= u.minutes;
      rawLeft -= u.minutes;
      if (isMain(u)) mains++;
    };
    /** `sameDay`: a second session of one item on the same day is allowed only under deadline pressure. */
    const eligible = (u: PlanUnit, sameDay = false): boolean => {
      if (placed.has(u.id)) return false;
      if (u.item.earliest && u.item.earliest > day.date) return false;
      if (u.k === 0) return true;
      const part = placed.get(unitId(u.itemKey, u.k - 1))?.date ?? '9999';
      return sameDay ? part <= day.date : part < day.date;
    };

    // Rule 3: pinned – the user nailed the item to this day; capacity is not asked (overload is counted).
    for (const u of units) if (u.item.pinned === day.date && eligible(u)) put(u, 'pinned');

    // Rule 4: must start today to meet a hard due (deadline before priority); may eat the buffer and may
    // place a second session of the same item on this day (one pass per session).
    const must: PlanUnit[] = [];
    for (let pass = 0; pass < 8; pass++) {
      const batch = units
        .filter((u) => eligible(u, true) && !must.includes(u))
        .map((u) => [u, latestStart(u, horizon, s)] as const)
        .filter((x): x is readonly [PlanUnit, string] => x[1] !== undefined && x[1] <= day.date)
        .sort(
          ([a, la], [b, lb]) =>
            cmp(la, lb) ||
            cmp(a.item.due!.date, b.item.due!.date) ||
            b.item.priority - a.item.priority ||
            cmp(a.id, b.id),
        );
      if (batch.length === 0) break;
      let any = false;
      for (const [u] of batch) {
        must.push(u);
        if (u.minutes <= left) {
          put(u, 'deadline');
          any = true;
        } else if (u.minutes <= rawLeft) {
          put(u, 'deadline-buffer');
          any = true;
        }
        // else: stays in the pool; after its due it is reported as late (see below)
      }
      if (!any) break;
    }

    // Rule 5: everything else by priority, then kept ↑ carried ↑ new, soft due, age, id. A unit planned
    // for a later day is never pulled forward here: only rule 4 (deadline) may pull.
    const rest = units
      .filter(
        (u) => eligible(u) && !must.includes(u) && !((prevByUnit.get(u.id)?.date ?? '') > day.date),
      )
      .sort(
        (a, b) =>
          b.item.priority - a.item.priority ||
          sticky(b, day.date) - sticky(a, day.date) ||
          cmp(a.item.due?.date ?? '9999', b.item.due?.date ?? '9999') ||
          a.item.createdAt - b.item.createdAt ||
          cmp(a.id, b.id),
      );
    for (const u of rest) {
      if (u.minutes > left) continue;
      if (isMain(u) && mains >= s.mainPerDay) continue;
      const p = prevByUnit.get(u.id);
      const bump = bumps.find((x) => x.id === u.id);
      const reason: Assignment['reason'] = !p
        ? 'new'
        : p.date === day.date
          ? p.reason
          : p.date < day.date
            ? (bump?.cause ?? 'carried')
            : 'pulled';
      put(u, reason, bump && reason === bump.cause ? bump.by : undefined);
    }

    // Rule 6: what was planned for today before and did not get a place – who took the room?
    for (const u of units) {
      const p = prevByUnit.get(u.id);
      if (!p || p.date !== day.date || placed.has(u.id)) continue;
      // A later session cannot stay on a day its earlier session has not reached: the cause is the part.
      const partId = unitId(u.itemKey, u.k - 1);
      const part = u.k > 0 ? placed.get(partId) : undefined;
      if (u.k > 0 && !(part && part.date < day.date)) {
        bumps.push({ id: u.id, date: day.date, by: [partId], cause: 'after-part' });
        continue;
      }
      const tierOfU = must.includes(u) ? 1 : 2;
      const outranks = (a: Assignment): boolean => {
        const ta = tierOfReason(a.reason);
        if (ta !== tierOfU) return ta < tierOfU;
        const au = unitById.get(a.id)!;
        return (
          au.item.priority > u.item.priority ||
          (au.item.priority === u.item.priority && sticky(au, day.date) >= sticky(u, day.date))
        );
      };
      const by = todayList
        .filter(
          (a) => a.itemKey !== u.itemKey && prevByUnit.get(a.id)?.date !== day.date && outranks(a),
        )
        .sort((a, b) => b.minutes - a.minutes || cmp(a.id, b.id))
        .map((a) => a.id);
      bumps.push({ id: u.id, date: day.date, by, cause: by.length ? 'bumped' : 'capacity' });
    }

    // Final order of the day without `prev`: pinned, deadline, then priority ↓, due ↑, age ↑, id –
    // so a rerun on the same input gives the same (unit, date, minutes, order).
    const pinnedIds = new Set(units.filter((u) => u.item.pinned === day.date).map((u) => u.id));
    const mustIds = new Set(must.map((u) => u.id));
    const tierOf = (a: Assignment): number => (pinnedIds.has(a.id) ? 0 : mustIds.has(a.id) ? 1 : 2);
    todayList
      .sort((a, b) => {
        const ua = unitById.get(a.id)!.item;
        const ub = unitById.get(b.id)!.item;
        return (
          tierOf(a) - tierOf(b) ||
          ub.priority - ua.priority ||
          cmp(ua.due?.date ?? '9999', ub.due?.date ?? '9999') ||
          ua.createdAt - ub.createdAt ||
          cmp(a.id, b.id)
        );
      })
      .forEach((a, i) => (a.order = i));
    const planned = todayList.reduce((n, a) => n + a.minutes, 0);
    load[day.date] = {
      raw: cap.raw,
      usable: cap.usable,
      planned,
      free: Math.max(0, cap.usable - planned),
      over: Math.max(0, planned - cap.usable),
      mains,
    };
  }

  // Rule 7: honest output – late and unplaced units, with their reason.
  const unplaced: Unplaced[] = [];
  const lastDay = horizon.at(-1)?.date;
  for (const u of units) {
    const a = placed.get(u.id);
    const base = { id: u.id, itemKey: u.itemKey, k: u.k, of: u.of, minutes: u.minutes };
    if (a && u.item.due?.hard && a.date > u.item.due.date) {
      a.late = true;
      unplaced.push({ ...base, reason: 'after-hard-due', date: a.date, due: u.item.due.date });
    } else if (!a) {
      const ls = latestStart(u, horizon, s);
      const fits = horizon.some((d) => u.minutes <= capacity(d, s).usable);
      const bump = bumps.find((x) => x.id === u.id);
      unplaced.push({
        ...base,
        reason: !fits
          ? 'too-long'
          : ls !== undefined && lastDay !== undefined && ls < lastDay
            ? 'after-hard-due'
            : 'horizon',
        ...(bump?.by.length ? { bumpedBy: bump.by } : {}),
      });
    }
  }

  const diff = diffPlans(prev, assignments, bumps, new Set(unitById.keys()));
  const demandMin = units.reduce((n, u) => n + u.minutes, 0);
  const usableMin = Object.values(load).reduce((n, l) => n + l.usable, 0);
  return {
    assignments,
    unplaced,
    diff,
    load,
    overflowMin: Math.max(0, demandMin - usableMin),
    demandMin,
    usableMin,
  };
}
