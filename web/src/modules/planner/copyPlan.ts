/**
 * What „Plan als Text kopieren“ takes from the board (use case „Tag kippt“, P3) – pure, so the privacy of the copy is
 * pinned by a test: titles, days, minutes, the goal and the times of fixed blocks; nothing else of a row.
 */
import type { BoardDay, WaitingRow } from './board';
import type { CopyThing } from './pastePlan';

export interface CopyInput {
  goal?: string;
  days: {
    date: string;
    things: CopyThing[];
    fixed: { title: string; from: string; to: string }[];
  }[];
  week: CopyThing[];
  later: CopyThing[];
}

/**
 * The plan from `from` to `to` (the days he looks at):
 * - each thing once, on its first day in the range, with the minutes of all its parts there – none when they are only
 *   the default guess (`approx`);
 * - fixed blocks as remarks (their time and title), so a re-split knows the day is shorter;
 * - „Noch ohne Tag“: things without a day and the muted „In ToDos“ things – never what he left out („Nicht planen“);
 * - the goal only when every day with things carries the same one (pasted back, a goal goes onto every named day).
 */
export function copyInput(
  days: readonly Pick<BoardDay, 'date' | 'rows' | 'row' | 'hints'>[],
  waiting: readonly Pick<
    WaitingRow,
    'itemKey' | 'title' | 'minutes' | 'reason' | 'entry' | 'item'
  >[],
  later: readonly { title: string }[],
  range: { from: string; to: string },
): CopyInput {
  const inRange = days.filter((d) => d.date >= range.from && d.date <= range.to);
  const total = new Map<string, number>();
  const guessed = new Set<string>();
  for (const d of inRange)
    for (const r of d.rows)
      if (r.entry && !r.fixed) {
        total.set(r.itemKey, (total.get(r.itemKey) ?? 0) + r.minutes);
        if (r.approx) guessed.add(r.itemKey);
      }
  const seen = new Set<string>();
  const thing = (key: string, title: string, minutes: number | undefined): CopyThing[] => {
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ title, ...(minutes && !guessed.has(key) ? { minutes } : {}) }];
  };
  const out: CopyInput = {
    days: inRange.map((d) => ({
      date: d.date,
      fixed: d.rows.flatMap((r) =>
        r.fixed ? [{ title: r.title, from: r.fixed.from, to: r.fixed.to }] : [],
      ),
      things: d.rows
        .filter((r) => r.entry && !r.fixed)
        .flatMap((r) => thing(r.itemKey, r.title, total.get(r.itemKey))),
    })),
    week: [
      ...waiting
        .filter((w) => w.entry && w.reason !== 'later' && w.reason !== 'excluded')
        .flatMap((w) => {
          // Minutes only when someone set them (the plan's own or the source's), never the default guess.
          if (w.item?.durationMin === undefined && w.entry?.durationMin === undefined)
            guessed.add(w.itemKey);
          return thing(w.itemKey, w.title, w.minutes);
        }),
      ...inRange.flatMap((d) =>
        (d.hints ?? []).flatMap((h) => thing(h.itemKey, h.title, undefined)),
      ),
    ],
    later: later.map((l) => ({ title: l.title })),
  };
  // Only days with things count: pasted back, `goalDays` puts the goal on exactly those days.
  const withThings = inRange.filter((d) => out.days.find((x) => x.date === d.date)!.things.length);
  const goal = withThings[0]?.row?.note;
  if (goal && withThings.every((d) => d.row?.note === goal)) out.goal = goal;
  return out;
}
