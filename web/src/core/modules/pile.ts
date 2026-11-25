/**
 * Collective rows (planner hub 2, package 2, CONCEPT-ROWS idea 2): which plannable things fold into „Finanzen
 * checken“ / „E-Mails durchgehen“, and what the row counts. Pure: the parts come from the modules' `pile`
 * contributions (`collectPiles`), the things from `collectPlannable`; nothing here reads or writes.
 *
 * The rules core keeps for every module:
 *  - a member key stays only if its thing is in the plan's things, open, without a day of its own and without a lock;
 *  - it belongs to the part's own module, or – for mail – it is a ToDo whose `origin` link points to a mail thread;
 *  - never `accounts`; each key once; at most `PILE_MAX` per pile (the rest stay single rows and are not counted);
 *  - a pile is a row while it has something to do: folded members, or a count of a part that is not read-only (or a
 *    member the plan asked for whose thing is not read yet – it is about to be).
 */
import type { PlannableEntry } from './contributions';
import type { Pile, PileArea } from './types';

export const PILE_AREAS: readonly PileArea[] = ['money', 'mail'];
/** At most this many members fold into one pile. */
export const PILE_MAX = 40;
/** A module that is never part of a pile (the password vault). */
const NEVER = 'accounts';

/** A module's part with the module that made it. */
export type PileEntry = Pile & { moduleId: string };

/** The planner's item key of a pile row (`planner:pile-money`). */
export const pileKey = (area: PileArea): string => `planner:pile-${area}`;
/** The planner source's id of a pile row (`pile-money`). */
export const pileId = (area: PileArea): string => `pile-${area}`;
/** The area of a pile's source id, or undefined for any other id. */
export const areaOfPileId = (id: string): PileArea | undefined =>
  PILE_AREAS.find((a) => pileId(a) === id);

export interface PilePart {
  pile: PileEntry;
  /** The folded member keys of this part, in the module's order. */
  members: string[];
}

export interface PileGroup {
  area: PileArea;
  parts: PilePart[];
  /** Folded members + counts of the parts that are not read-only: what the row says waits. */
  count: number;
  /** The row has something to do (members, or a count that is not read-only). */
  alive: boolean;
  /** The earliest hard deadline of the folded members and the parts ('YYYY-MM-DD'). */
  due?: string;
}

export interface Folded {
  groups: Map<PileArea, PileGroup>;
  /** Member key → the area of the pile it folds into. */
  folded: Map<string, PileArea>;
}

const keyOf = (e: Pick<PlannableEntry, 'moduleId' | 'id'>) => `${e.moduleId}:${e.id}`;

/** A ToDo whose `origin` link points to a mail thread (a mail pile's member made by mail). */
function fromMail(e: PlannableEntry): boolean {
  if (e.moduleId !== 'todos') return false;
  return (e.links ?? []).some((l) => l.rel === 'origin' && l.to.module === 'mail');
}

function mayFold(part: PileEntry, e: PlannableEntry): boolean {
  if (e.moduleId === NEVER || part.moduleId === NEVER) return false;
  if (e.moduleId === part.moduleId) return true;
  return part.area === 'mail' && part.moduleId === 'mail' && fromMail(e);
}

const earlier = (a: string | undefined, b: string | undefined) =>
  a === undefined ? b : b === undefined ? a : a < b ? a : b;

/**
 * Folds the plan's things into the piles of the areas that are switched on. `held`: item keys that have a day or a
 * lock of their own (a placement row, a dated turn, the person's own date) – they stay single rows and are not counted.
 */
export function foldPiles(
  parts: readonly PileEntry[],
  entries: readonly PlannableEntry[],
  opts: {
    areas: ReadonlySet<PileArea>;
    held: ReadonlySet<string>;
    /**
     * Keys the plan asked for whose thing may not be read yet (the planner's request rows): such a member keeps the
     * pile a row meanwhile – a ToDo mail made a moment ago – and is not counted. Any other unknown key is ignored.
     */
    expected?: ReadonlySet<string>;
  },
): Folded {
  const byKey = new Map(entries.map((e) => [keyOf(e), e]));
  const groups = new Map<PileArea, PileGroup>();
  const folded = new Map<string, PileArea>();
  for (const area of PILE_AREAS) {
    if (!opts.areas.has(area)) continue;
    const own = parts.filter((p) => p.area === area && p.moduleId !== NEVER);
    if (own.length === 0) continue;
    let members = 0;
    let waiting = 0;
    // A member the plan asked for whose thing is not read yet (a ToDo mail made a moment ago): the pile stays a row
    // meanwhile, so it does not flicker away between the two readings; it is not counted.
    let pending = 0;
    let due: string | undefined;
    const out: PilePart[] = [];
    for (const pile of own) {
      const kept: string[] = [];
      for (const key of pile.members ?? []) {
        if (members >= PILE_MAX) break;
        const e = byKey.get(key);
        if (!e && opts.expected?.has(key) && !key.startsWith(`${NEVER}:`)) pending += 1;
        if (!e || e.done || opts.held.has(key) || folded.has(key) || !mayFold(pile, e)) continue;
        folded.set(key, area);
        kept.push(key);
        members += 1;
        if (e.due?.hard) due = earlier(due, e.due.date);
      }
      if (!pile.readOnly) waiting += Math.max(0, pile.count);
      due = earlier(due, pile.due);
      out.push({ pile, members: kept });
    }
    const count = members + waiting;
    groups.set(area, {
      area,
      parts: out,
      count,
      alive: count > 0 || pending > 0,
      ...(due ? { due } : {}),
    });
  }
  return { groups, folded };
}
