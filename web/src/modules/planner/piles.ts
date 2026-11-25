/**
 * The planner's collective rows (planner hub 2, package 2, CONCEPT-ROWS idea 2): which areas are switched on, the
 * modules' parts, and the fold over the plan's things. One reading for the planner's own source (`plannable.ts`), the
 * board, the runs (folded members are never proposed one by one) and nothing else. Reads only; a count that changes
 * – also to 0 – writes nothing here.
 */
import { loadModuleStates } from '@/core/modules/activation';
import { activeManifests, collectPiles, type PlannableEntry } from '@/core/modules/contributions';
import { foldPiles, PILE_AREAS, pileKey, type Folded, type PileEntry } from '@/core/modules/pile';
import type { ModuleManifest, PileArea } from '@/core/modules/types';
import type { PlannerSettings } from './settings';

/** Default minutes of a pile row (hand-off 02): money 20, mail 30; „Dauer …“ changes the pile's own item row. */
export const PILE_MINUTES: Record<PileArea, number> = { money: 20, mail: 30 };

/** The areas whose switch is on (`pileMoney`, `pileMail`; `undefined` = never asked = off). */
export function pileAreas(s: Pick<PlannerSettings, 'pileMoney' | 'pileMail'>): Set<PileArea> {
  const on = new Set<PileArea>();
  if (s.pileMoney === true) on.add('money');
  if (s.pileMail === true) on.add('mail');
  return on;
}

/**
 * The one fold of the board and the run: what stands on its own (a placement row, „Nicht planen“), what the plan asked
 * for (request rows), then `folded` (member keys) and `idle` (pile keys with nothing to do – never proposed, and an
 * unplaced one is no row).
 */
export function foldRows(
  parts: readonly PileEntry[],
  entries: readonly PlannableEntry[],
  areas: ReadonlySet<PileArea>,
  itemRows: Iterable<{ id: string; excluded?: boolean; skipped?: string }>,
  assignmentKeys: Iterable<string>,
): { fold: Folded; folded: Set<string>; idle: Set<string> } {
  const rows = [...itemRows];
  const fold = foldPlan(
    parts,
    entries,
    areas,
    [...assignmentKeys, ...rows.filter((r) => r.excluded).map((r) => r.id)],
    rows.filter((r) => !r.excluded && !r.skipped).map((r) => r.id),
  );
  return {
    fold,
    folded: new Set(fold.folded.keys()),
    idle: new Set(PILE_AREAS.filter((a) => !fold.groups.get(a)?.alive).map((a) => pileKey(a))),
  };
}

/** The areas never asked about (`undefined`): the offer P5 may show for them. */
export function pileUnasked(s: Pick<PlannerSettings, 'pileMoney' | 'pileMail'>): Set<PileArea> {
  const out = new Set<PileArea>();
  if (s.pileMoney === undefined) out.add('money');
  if (s.pileMail === undefined) out.add('mail');
  return out;
}

/** The parts of the switched-on areas from the active modules (a failing part is missing, the rest stays). */
export async function loadPileParts(
  ctx: { today: string; until: string },
  areas: ReadonlySet<PileArea>,
  manifests?: readonly ModuleManifest[],
): Promise<PileEntry[]> {
  if (areas.size === 0) return [];
  const parts = await collectPiles(ctx, manifests ?? activeManifests(await loadModuleStates()));
  return parts.filter((p) => areas.has(p.area));
}

/**
 * The things that stand on their own: a placement row (also „fest“), a dated turn, the person's own date. They are
 * never folded and never counted.
 */
export function heldKeys(
  entries: readonly PlannableEntry[],
  placed: Iterable<string>,
): Set<string> {
  const held = new Set(placed);
  for (const e of entries) if (e.day || e.plannedFor) held.add(`${e.moduleId}:${e.id}`);
  return held;
}

/** The fold of the plan's things into the switched-on piles; the pile rows themselves never fold. */
export function foldPlan(
  parts: readonly PileEntry[],
  entries: readonly PlannableEntry[],
  areas: ReadonlySet<PileArea>,
  placed: Iterable<string>,
  /** The planner's request rows: a member among them whose thing is not read yet keeps its pile a row meanwhile. */
  requested?: Iterable<string>,
): Folded {
  const held = heldKeys(entries, placed);
  for (const a of PILE_AREAS) held.add(pileKey(a));
  return foldPiles(parts, entries, {
    areas,
    held,
    ...(requested ? { expected: new Set(requested) } : {}),
  });
}

/**
 * The offer P5: one at a time, money before mail – the first area never asked about with at least `from` waiting rows
 * that would fold, unless it was dismissed on this device.
 */
export function pickOffer(
  waitingKeys: readonly string[],
  would: ReadonlyMap<string, PileArea>,
  unasked: ReadonlySet<PileArea>,
  dismissed: (area: PileArea) => boolean,
  from: number,
): { area: PileArea; n: number } | undefined {
  for (const area of PILE_AREAS) {
    if (!unasked.has(area) || dismissed(area)) continue;
    const n = waitingKeys.filter((k) => would.get(k) === area).length;
    if (n >= from) return { area, n };
  }
  return undefined;
}
