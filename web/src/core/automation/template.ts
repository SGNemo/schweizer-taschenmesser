/** `{field}` placeholders in action data. Pure. */
import type { AutomationEvent } from './types';

const WHOLE = /^\{([\w.]+)\}$/;
const ANY = /\{([\w.]+)\}/g;

export function readField(data: Record<string, unknown>, path: string): unknown {
  let cur: unknown = data;
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function fill(value: string | number | boolean, event: AutomationEvent): unknown {
  if (typeof value !== 'string') return value;
  const whole = WHOLE.exec(value);
  if (whole) return readField(event.data, whole[1]!);
  return value.replace(ANY, (_, path: string) => {
    const v = readField(event.data, path);
    return v === undefined || v === null ? '' : String(v);
  });
}

export function fillAll(
  data: Record<string, string | number | boolean> | undefined,
  event: AutomationEvent,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    const f = fill(v, event);
    if (f !== undefined && f !== '') out[k] = f;
  }
  return out;
}

export const fillText = (value: string, event: AutomationEvent): string =>
  String(fill(value, event) ?? '');
