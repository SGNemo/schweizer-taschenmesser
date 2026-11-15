import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { dayName } from '@/core/plan/explain';
import { t } from '@/strings';
import type { RowMenuItem } from '@/ui';
import {
  exclude,
  include,
  later,
  markDone,
  markDue,
  sourceAbilities,
  type SourceAbility,
  unmarkDue,
  unpin,
} from '../actions';
import type { BoardRow, WaitingRow } from '../board';
import { beginPlanFocus, planFocusPath } from '../focus';
import type { RowChoiceState } from './RowChoice';

/** Which sources take a tick, „Später“, „Als Pause …“ or „Dauer …“ (an invoice, a cancellation: no – that stays in its module). */
export function useAbilities() {
  const [abilities, setAbilities] = useState<Record<string, SourceAbility>>();
  useEffect(() => {
    let live = true;
    void sourceAbilities().then((a) => live && setAbilities(a));
    return () => {
      live = false;
    };
  }, []);
  return {
    // Until they are known every source counts as able (no jump for ToDo rows); `markDone` checks again.
    canDone: (moduleId: string) => abilities?.[moduleId]?.done ?? true,
    canAssign: (moduleId: string) => abilities?.[moduleId]?.assign ?? true,
    // Shown only once the source is known to take them (a missing ability hides, never offers in vain).
    canRemove: (moduleId: string) => abilities?.[moduleId]?.remove === true,
    canEstimate: (moduleId: string) => abilities?.[moduleId]?.estimate === true,
  };
}

export type Abilities = ReturnType<typeof useAbilities>;

/**
 * Builds the ⋯ menu of a row; `date` = the row's day (a waiting row has none: then today, named). The steps of
 * every day come first („Verschieben …“, „Später“, „Dauer …“, „Tagesabschnitt …“), the rest under „Mehr“. `tick`: the row's lead is
 * the tick, so „Erledigt“ is not said twice. The row adds its action's word in front and its links under
 * „Verknüpft“ (`ThingRow`, K1b) – the links are no longer hard-coded entries here.
 */
export function useRowMenu(ctx: {
  today: string | undefined;
  titles: Record<string, string>;
  abilities: Abilities;
  why: string | undefined;
  setWhy: (unitId: string | undefined) => void;
  setChoice: (choice: RowChoiceState) => void;
}) {
  const navigate = useNavigate();
  const { titles, abilities, why, setWhy, setChoice } = ctx;
  return (
    row: BoardRow | WaitingRow,
    date?: string,
    reason?: string,
    opts: { tick?: boolean; late?: boolean } = {},
  ): RowMenuItem[] => {
    const e = row.entry;
    if (!e || !ctx.today) return [];
    // „Frist vorbei“: the thing sits on no day, so nothing here moves, nails or orders it. What is left:
    // open it, or take it out of the plan.
    if (opts.late)
      return [
        { id: 'open', label: t.planner.row.open, onSelect: () => void navigate(e.to) },
        { id: 'exclude', label: t.planner.row.exclude, onSelect: () => void exclude(e, titles) },
      ];
    const day = date ?? ctx.today;
    const pinned = row.item?.pinned !== undefined;
    const hard = row.item?.due?.hard === true;
    // A deadline the source holds (invoice, cancellation) is not the planner's to lift or set.
    const sourceHard = e.due?.hard === true;
    const excluded = row.item?.excluded === true;
    const open = why === row.unitId;
    const top: RowMenuItem[] = [
      ...(abilities.canDone(e.moduleId) && !opts.tick
        ? [{ id: 'done', label: t.planner.row.done, onSelect: () => void markDone(e, titles) }]
        : []),
      // „Verschieben …“ (R2): day chips; the chosen day is where the thing stays (the one place that nails).
      ...(excluded
        ? []
        : [
            {
              id: 'move',
              label: t.planner.row.move,
              onSelect: () =>
                setChoice({
                  kind: 'move',
                  entry: e,
                  ...(date ? { on: date } : {}),
                  ...(row.item?.pinned ? { pinned: row.item.pinned } : {}),
                }),
            },
          ]),
      ...(abilities.canAssign(e.moduleId)
        ? [{ id: 'later', label: t.planner.row.later, onSelect: () => void later(e, titles) }]
        : []),
      ...(abilities.canEstimate(e.moduleId)
        ? [
            {
              id: 'estimate',
              label: t.planner.row.estimate,
              onSelect: () =>
                setChoice({
                  kind: 'estimate',
                  entry: e,
                  ...(e.durationMin !== undefined ? { current: e.durationMin } : {}),
                }),
            },
          ]
        : []),
      // „Tagesabschnitt …“ (package 4b): one entry, the choice opens in `RowChoice`; only on a row of a day
      // (a waiting row has no day to order in yet).
      ...(date
        ? [
            {
              id: 'dayPart',
              label: t.planner.row.dayPart,
              onSelect: () =>
                setChoice({
                  kind: 'part',
                  entry: e,
                  ...(row.item?.part ? { current: row.item.part } : {}),
                }),
            },
          ]
        : []),
    ];
    const more: RowMenuItem[] = [
      ...(excluded
        ? [{ id: 'include', label: t.planner.row.include, onSelect: () => void include(e, titles) }]
        : [
            // Nailing is „Verschieben …“ (also onto the day the thing is on); here only the way back.
            ...(pinned
              ? [{ id: 'unpin', label: t.planner.row.unpin, onSelect: () => void unpin(e, titles) }]
              : []),
            {
              id: 'exclude',
              label: t.planner.row.exclude,
              onSelect: () => void exclude(e, titles),
            },
          ]),
      ...(sourceHard
        ? []
        : [
            hard
              ? {
                  id: 'unmarkDue',
                  label: t.planner.row.unmarkDue,
                  onSelect: () => void unmarkDue(e, titles),
                }
              : {
                  id: 'markDue',
                  label: t.planner.row.markDueOn(dayName(e.due?.date ?? day)),
                  onSelect: () => void markDue(e, e.due?.date ?? day, titles),
                },
          ]),
      ...(abilities.canRemove(e.moduleId)
        ? [
            {
              id: 'asBreak',
              label: t.planner.row.asBreak,
              onSelect: () => setChoice({ kind: 'break', entry: e, date: day }),
            },
          ]
        : []),
      ...(reason
        ? [
            {
              id: 'why',
              label: t.planner.row.why,
              checked: open,
              onSelect: () => setWhy(open ? undefined : row.unitId),
            },
          ]
        : []),
      ...(date
        ? [
            {
              id: 'focus',
              label: t.planner.row.focus,
              onSelect: () => {
                const title =
                  row.of > 1
                    ? `${row.title} · ${t.planner.row.part(row.k + 1, row.of)}`
                    : row.title;
                void beginPlanFocus({ unitId: row.unitId, title, minutes: row.minutes }).then(() =>
                  navigate(planFocusPath(row.unitId)),
                );
              },
            },
          ]
        : []),
      { id: 'open', label: t.planner.row.open, onSelect: () => void navigate(e.to) },
    ];
    return [
      ...top,
      ...more.map((item, i) => (i === 0 ? { ...item, group: t.planner.row.more } : item)),
    ];
  };
}
