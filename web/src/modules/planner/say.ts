/**
 * The planner's field as a place to *say* something (CONCEPT §6c): the things of the board as
 * matching targets for `core/plan/instructions.ts` and one calm line per op for the preview. Pure.
 */
import { formatMinutes } from '@/core/i18n/format';
import { dayName } from '@/core/plan/explain';
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

/** What one op asks for, in a calm line („Do ist frei.“, „Steuer festgenagelt auf Fr“). */
export function opLine(op: PlanOp, titleOf: (key: string) => string): string {
  const o = t.planner.ops;
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
export function opLines(ops: readonly PlanOp[], titleOf: (key: string) => string): string[] {
  const earliest = ops.filter((o) => o.op === 'earliest');
  if (earliest.length > 1) {
    const rest = ops.filter((o) => o.op !== 'earliest').map((o) => opLine(o, titleOf));
    const day = dayName((earliest[0] as Extract<PlanOp, { op: 'earliest' }>).date);
    return [...rest, t.planner.ops.earliestMany(earliest.length, day)];
  }
  return ops.map((o) => opLine(o, titleOf));
}
