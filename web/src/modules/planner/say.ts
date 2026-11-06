/**
 * The planner's field as a place to *say* something (CONCEPT §6c): the things of the board as
 * matching targets for `core/plan/instructions.ts` and one calm line per op for the preview. Pure.
 */
import type { PlanLine } from '@/core/ai/local/prompts/plan';
import { formatMinutes } from '@/core/i18n/format';
import { addDays } from '@/core/plan/dates';
import { dayName } from '@/core/plan/explain';
import { formatDay } from '@/core/time/dates';
import type { InstructionItem, PlanOp } from '@/core/plan/instructions';
import { t } from '@/strings';
import type { Board } from './board';

/** Every thing on the board (planned or waiting) once, with its first day and its hard due. */
export function instructionItems(board: Board): InstructionItem[] {
  const out = new Map<string, InstructionItem>();
  for (const day of board.days)
    for (const row of day.rows) {
      if (out.has(row.itemKey)) continue;
      const hardDue = row.hardDue ?? (row.item?.due?.hard ? row.item.due.date : undefined);
      out.set(row.itemKey, {
        key: row.itemKey,
        title: row.title,
        date: day.date,
        ...(hardDue ? { hardDue } : {}),
      });
    }
  for (const w of board.waiting) {
    if (out.has(w.itemKey)) continue;
    const hardDue = w.item?.due?.hard ? w.item.due.date : undefined;
    out.set(w.itemKey, { key: w.itemKey, title: w.title, ...(hardDue ? { hardDue } : {}) });
  }
  return [...out.values()];
}

/**
 * The compact plan for the local stage (`localStage.ts`): every thing once with its minutes over all
 * sessions, its priority, its hard due and the first day it is planned on. Titles and planning facts
 * only – never blocker labels, day notes or anything the sentence does not need.
 */
export function planLines(board: Board): PlanLine[] {
  const out = new Map<string, PlanLine>();
  const add = (
    row: { itemKey: string; title: string; minutes: number; hardDue?: string } & Pick<
      Board['days'][number]['rows'][number],
      'item' | 'entry'
    >,
    day?: string,
  ) => {
    const cur = out.get(row.itemKey);
    if (cur) {
      cur.min += row.minutes;
      return;
    }
    const due = row.hardDue ?? (row.item?.due?.hard ? row.item.due.date : undefined);
    out.set(row.itemKey, {
      key: row.itemKey,
      title: row.title,
      min: row.minutes,
      prio: row.item?.priority ?? row.entry?.priority ?? 0,
      ...(due ? { due } : {}),
      ...(day ? { day } : {}),
    });
  };
  for (const day of board.days) for (const row of day.rows) add(row, day.date);
  for (const w of board.waiting) add(w);
  return [...out.values()];
}

/**
 * A day in a preview line: the short weekday inside the board's week, with the date beyond it – on a
 * Thursday „Donnerstag frei“ is next week's Thursday, and „Do“ alone would read as today.
 */
const dayOf = (date: string, today: string): string =>
  date > addDays(today, 6) ? `${dayName(date)} ${formatDay(date, 'd.M.')}` : dayName(date);

/** What one op asks for, in a calm line („Do ist frei.“, „Steuer festgenagelt auf Fr“). */
export function opLine(op: PlanOp, titleOf: (key: string) => string, today: string): string {
  const o = t.planner.ops;
  const dayName = (date: string) => dayOf(date, today);
  const min = (m: number) => formatMinutes(m, { compact: true });
  switch (op.op) {
    case 'available':
      return op.min === 0
        ? t.planner.toast.dayOff(dayName(op.date))
        : t.planner.toast.available(dayName(op.date), min(op.min));
    case 'block':
      return o.block(dayName(op.date), op.label, op.from, op.to);
    case 'pin':
      return o.pin(titleOf(op.key), dayName(op.date));
    case 'earliest':
      return o.earliest(titleOf(op.key), dayName(op.date));
    case 'priority':
      return o.priority(titleOf(op.key));
    case 'exclude':
      return o.exclude(titleOf(op.key));
    case 'duration':
      return o.duration(titleOf(op.key), min(op.min));
    case 'buffer':
      return o.buffer(op.pct);
    case 'replan':
      return op.reshuffle ? o.reshuffle : o.replan;
  }
}

/** The lines of a sentence: several „nicht vor Fr“ of one move are said once („3 Dinge nicht vor Fr“). */
export function opLines(
  ops: readonly PlanOp[],
  titleOf: (key: string) => string,
  today: string,
): string[] {
  const earliest = ops.filter((o) => o.op === 'earliest');
  if (earliest.length > 1) {
    const rest = ops.filter((o) => o.op !== 'earliest').map((o) => opLine(o, titleOf, today));
    const day = dayOf((earliest[0] as Extract<PlanOp, { op: 'earliest' }>).date, today);
    return [...rest, t.planner.ops.earliestMany(earliest.length, day)];
  }
  return ops.map((o) => opLine(o, titleOf, today));
}
