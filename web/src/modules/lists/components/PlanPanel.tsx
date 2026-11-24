/**
 * A list's panel under its plan row (planner hub 2, package 4a; hand-off 04): the open entries as tick lines, grouped by
 * section (shopping) or category (packing) under small heads; at most 8, then X19 „n weitere“, which shows 8 more – no
 * scroll box inside a row. Each tick is Listen's own write with its own undo toast. Foot: X8 „Fertig eingekauft“ (the
 * module's existing „Gekauftes entfernen“) once nothing is open on a shopping list, and „Ganz öffnen“.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
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
  const hold = (itemId: string) => {
    setHeld((cur) => new Set(cur).add(itemId));
    setTimeout(
      () =>
        setHeld((cur) => {
          const next = new Set(cur);
          next.delete(itemId);
          return next;
        }),
      PANEL_HOLD_MS,
    );
  };
  if (read === undefined) return <PanelLoading />;
  if (read === null) return <PanelGone />;
  const { list, items } = read;
  const open = items.filter((i) => !i.done);
  const doneCount = items.length - open.length;
  const drawn = items.filter((i) => !i.done || held.has(i.id));
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
  const more = drawn.length - Math.min(shown, drawn.length);
  const named = groups.length > 1 || groups[0]?.id !== '';
  return (
    <>
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
                    checked={i.done || held.has(i.id)}
                    onChange={(e) => {
                      if (e.target.checked) hold(i.id);
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
      {more > 0 ? (
        <Button variant="ghost" onClick={() => setShown((n) => n + PANEL_STEP)}>
          {t.planner.panel.more(more)}
        </Button>
      ) : null}
      <PlanPanelFoot>
        {isShopping && open.length === 0 && doneCount > 0 ? (
          <Button
            variant="secondary"
            onClick={() =>
              void undoableWithToast(t.lists.cleared(doneCount), t.lists.cleared(doneCount), () =>
                clearDone(list.id),
              )
            }
          >
            {t.lists.panel.doneShopping}
          </Button>
        ) : null}
      </PlanPanelFoot>
    </>
  );
}
