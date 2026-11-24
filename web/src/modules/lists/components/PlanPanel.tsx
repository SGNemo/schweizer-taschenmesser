/**
 * A list's panel under its plan row (planner hub 2, package 4a; hand-off 04): the open entries as tick lines, grouped by
 * section (shopping) or category (packing) under small heads; at most 8, then X19 „n weitere“, which shows 8 more – no
 * scroll box inside a row. Each tick is Listen's own write with its own undo toast. Foot: X8 „Fertig eingekauft“ (the
 * module's existing „Gekauftes entfernen“, named so while entries are still open) while a shopping list holds ticked
 * entries – a list with nothing open leaves the plan at once, so „once nothing is open“ alone would never be seen –
 * and „Ganz öffnen“.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelGone, PanelHead, PanelLoading, PlanPanelFoot } from '@/core/modules/PlanPanelHost';
import type { PlanPanelProps } from '@/core/modules/types';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Checkbox, PanelLine, PanelLines } from '@/ui';
import { groupItems, type ItemGroup } from '../logic';
import { clearDone, itemRepo, itemsOf, listRepo } from '../repo';

/** Lines shown at first and added per „n weitere“. */
export const PANEL_STEP = 8;
/** A ticked line stays this long (ticked, muted) before it leaves the panel. */
export const PANEL_HOLD_MS = 1500;

/** The first `n` lines over the groups: the cap counts lines, not groups; a group cut in the middle keeps its head. */
export function capped<T>(
  groups: readonly ItemGroup<T>[],
  n: number,
): { id: string; lines: T[] }[] {
  const out: { id: string; lines: T[] }[] = [];
  let left = n;
  for (const g of groups) {
    if (left <= 0) break;
    const lines = g.items.slice(0, left);
    left -= lines.length;
    out.push({ id: g.id, lines });
  }
  return out;
}

/** One entry ticked from the plan: the same write and toast as on the list's own page. */
function tick(id: string, name: string, done: boolean) {
  const message = done ? t.lists.tickedItem(name) : t.lists.reopenedItem(name);
  void undoableWithToast(message, message, () => itemRepo.update(id, { done }));
}

export default function ListPlanPanel({ id, compact }: PlanPanelProps) {
  const read = useLiveQuery(async () => {
    const list = await listRepo.get(id);
    return list ? { list, items: await itemsOf(id) } : null;
  }, [id]);
  const [shown, setShown] = useState(PANEL_STEP);
  // Ticked here a moment ago: still drawn (ticked, muted), so the line does not vanish under the finger.
  const [held, setHeld] = useState<ReadonlySet<string>>(new Set());
  const box = useRef<HTMLDivElement>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const all = timers.current;
    return () => all.forEach((x) => clearTimeout(x));
  }, []);
  const seenDone = useRef(new Set<string>());
  const release = useCallback((itemId: string) => {
    // A hold ends whole: a later tick of the same line starts with nothing seen.
    seenDone.current.delete(itemId);
    clearTimeout(timers.current.get(itemId));
    timers.current.delete(itemId);
    setHeld((cur) => {
      if (!cur.has(itemId)) return cur;
      const next = new Set(cur);
      next.delete(itemId);
      return next;
    });
  }, []);
  // A held line whose entry was seen ticked and reads open again (Ctrl+Z, an undo on another device) is open: it
  // stays as an open line, unticked, and nothing moves the focus away from it.
  const items = read?.items;
  useEffect(() => {
    for (const i of items ?? []) {
      if (!held.has(i.id)) continue;
      if (i.done) seenDone.current.add(i.id);
      else if (seenDone.current.has(i.id)) release(i.id);
    }
  }, [items, held, release]);
  // „Gekauftes entfernen“ / X8 leaves with the bought entries, after the list re-read: then a focus that fell to the
  // page (or stayed on the gone button) goes to „Ganz öffnen“.
  const refocus = useRef(false);
  const bought = items?.some((i) => i.done) ?? false;
  useEffect(() => {
    if (!refocus.current || bought) return;
    refocus.current = false;
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected)
      box.current?.querySelector<HTMLElement>('[data-panel-open]')?.focus({ preventScroll: true });
  }, [bought]);
  /** The focused tick's line leaves: the focus goes to the next line's tick, else the one before, else the foot. */
  const keepFocus = (itemId: string) => {
    const ticks = [...(box.current?.querySelectorAll<HTMLElement>('input[type="checkbox"]') ?? [])];
    const at = ticks.findIndex((x) => x === document.activeElement);
    if (at < 0 || ticks[at]?.dataset.item !== itemId) return;
    const target =
      ticks[at + 1] ??
      ticks[at - 1] ??
      box.current?.querySelector<HTMLElement>('[data-panel-foot] button');
    target?.focus();
  };
  const hold = (itemId: string) => {
    setHeld((cur) => new Set(cur).add(itemId));
    timers.current.set(
      itemId,
      setTimeout(() => {
        keepFocus(itemId);
        release(itemId);
      }, PANEL_HOLD_MS),
    );
  };
  const more = (n: number, all: number) => {
    setShown(n + PANEL_STEP);
    // The button goes once everything is shown: then the focus goes to the first line it brought.
    if (n + PANEL_STEP >= all)
      requestAnimationFrame(() =>
        box.current?.querySelectorAll<HTMLElement>('input[type="checkbox"]')[n]?.focus(),
      );
  };
  if (read === undefined) return <PanelLoading />;
  if (read === null) return <PanelGone />;
  const { list } = read;
  const all = read.items;
  const open = all.filter((i) => !i.done);
  const doneCount = all.length - open.length;
  const drawn = all.filter((i) => !i.done || held.has(i.id));
  if (compact)
    return (
      <PanelLines>
        <PanelLine>{list.name}</PanelLine>
      </PanelLines>
    );
  const isShopping = list.kind === 'shopping';
  const groups = groupItems(drawn, isShopping ? 'section' : 'category');
  const headOf = (gid: string) =>
    isShopping
      ? gid
        ? t.lists.sections[gid]!
        : t.lists.noSection
      : gid || t.lists.sections.other!;
  const parts = capped(groups, shown);
  const rest = drawn.length - Math.min(shown, drawn.length);
  const named = groups.length > 1 || groups[0]?.id !== '';
  return (
    <div ref={box}>
      {parts.map((g) => (
        <div key={g.id || '-'}>
          {named ? <PanelHead>{headOf(g.id)}</PanelHead> : null}
          <PanelLines>
            {g.lines.map((i) => (
              <PanelLine
                key={i.id}
                done={i.done}
                {...(i.quantity ? { meta: i.quantity } : {})}
                tick={
                  <Checkbox
                    tone="neutral"
                    label={t.planner.panel.tick(i.name)}
                    labelHidden
                    data-item={i.id}
                    checked={i.done || held.has(i.id)}
                    onChange={(e) => {
                      // Unticked while held: the box says it at once, as the toast does.
                      if (e.target.checked) hold(i.id);
                      else release(i.id);
                      tick(i.id, i.name, e.target.checked);
                    }}
                  />
                }
              >
                {i.name}
              </PanelLine>
            ))}
          </PanelLines>
        </div>
      ))}
      {rest > 0 ? (
        <Button variant="ghost" onClick={() => more(shown, drawn.length)}>
          {t.planner.panel.more(rest)}
        </Button>
      ) : null}
      <PlanPanelFoot>
        {isShopping && doneCount > 0 ? (
          <Button
            variant="secondary"
            onClick={() => {
              refocus.current = true;
              void undoableWithToast(t.lists.cleared(doneCount), t.lists.cleared(doneCount), () =>
                clearDone(list.id),
              );
            }}
          >
            {/* X8 says the trip is over only when it is; with entries still open the module's own words. */}
            {/* No flash on the last tick: while a ticked line is still held the words stay. */}
            {open.length === 0 && held.size === 0
              ? t.lists.panel.doneShopping
              : t.lists.clearBought(doneCount)}
          </Button>
        ) : null}
      </PlanPanelFoot>
    </div>
  );
}
