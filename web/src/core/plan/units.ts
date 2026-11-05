import { DEFAULT_MIN, type PlanItem, type PlanSettings, type PlanUnit } from './types';

export const unitId = (itemKey: string, k: number): string => `${itemKey}#${k}`;

/** `<itemKey>#<k>` → its parts; the key itself may contain `#`? No: module ids and record ids never do. */
export function splitUnitId(id: string): { itemKey: string; k: number } {
  const i = id.lastIndexOf('#');
  return { itemKey: id.slice(0, i), k: Number(id.slice(i + 1)) };
}

export const itemMinutes = (item: Pick<PlanItem, 'durationMin'>): number =>
  item.durationMin ?? DEFAULT_MIN;

/**
 * Rule 2: an item longer than `maxSessionMin` that may be split becomes `ceil(min / max)` sessions
 * of equal length (≥ `minSessionMin`, the last one takes the rest); everything else is one unit.
 */
export function toUnits(
  item: PlanItem,
  settings: Pick<PlanSettings, 'maxSessionMin' | 'minSessionMin'>,
): PlanUnit[] {
  const min = itemMinutes(item);
  if (!item.splittable || min <= settings.maxSessionMin)
    return [{ id: unitId(item.key, 0), itemKey: item.key, k: 0, of: 1, minutes: min, item }];
  const of = Math.ceil(min / settings.maxSessionMin);
  const per = Math.max(settings.minSessionMin, Math.ceil(min / of));
  return Array.from({ length: of }, (_, k) => ({
    id: unitId(item.key, k),
    itemKey: item.key,
    k,
    of,
    minutes: k === of - 1 ? min - per * (of - 1) : per,
    item,
  }));
}
