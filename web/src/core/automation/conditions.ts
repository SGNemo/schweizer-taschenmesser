/** Condition evaluation. Pure: the clock comes in as `at`. */
import { readField } from './template';
import type { AutomationEvent, Condition } from './types';

const num = (v: unknown): number | undefined =>
  typeof v === 'number'
    ? v
    : typeof v === 'string' && v.trim() !== '' && !isNaN(+v)
      ? +v
      : undefined;

function compare(actual: unknown, op: string, expected: unknown): boolean {
  switch (op) {
    case 'eq':
      return actual === expected || String(actual) === String(expected);
    case 'neq':
      return !(actual === expected || String(actual) === String(expected));
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte': {
      const a = num(actual);
      const b = num(expected);
      if (a === undefined || b === undefined) {
        // dates "YYYY-MM-DD" and times "HH:mm" compare as text
        if (typeof actual !== 'string' || typeof expected !== 'string') return false;
        const c = actual.localeCompare(expected);
        return op === 'lt' ? c < 0 : op === 'lte' ? c <= 0 : op === 'gt' ? c > 0 : c >= 0;
      }
      return op === 'lt' ? a < b : op === 'lte' ? a <= b : op === 'gt' ? a > b : a >= b;
    }
    case 'contains':
      if (Array.isArray(actual)) return actual.some((x) => String(x) === String(expected));
      return (
        typeof actual === 'string' &&
        actual.toLocaleLowerCase().includes(String(expected).toLocaleLowerCase())
      );
    case 'in':
      return Array.isArray(expected) && expected.some((x) => String(x) === String(actual));
    default:
      return false;
  }
}

const minutes = (hhmm: string): number => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3);

/** A window may wrap midnight ("22:00"–"06:00"); weekdays are those of the window's start day. */
export function inWindow(
  window: { from: string; to: string; weekdays?: number[] },
  at: number,
): boolean {
  const d = new Date(at);
  const m = d.getHours() * 60 + d.getMinutes();
  const from = minutes(window.from);
  const to = minutes(window.to);
  const wraps = from > to;
  const inside = wraps ? m >= from || m < to : m >= from && m < to;
  if (!inside) return false;
  if (!window.weekdays || window.weekdays.length === 0) return true;
  const day = wraps && m < to ? (d.getDay() + 6) % 7 : d.getDay();
  return window.weekdays.includes(day);
}

export function matches(conditions: readonly Condition[], event: AutomationEvent): boolean {
  return conditions.every((c) =>
    'window' in c
      ? inWindow(c.window, event.at)
      : compare(readField(event.data, c.field), c.op, c.value),
  );
}
