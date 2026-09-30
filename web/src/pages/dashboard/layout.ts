import { z } from 'zod';

/** Stored in the synced `_settings` table under the scope "dashboard". */
export const dashboardLayoutSchema = z.object({
  /** Widget keys (`<moduleId>:<widgetId>`) in display order. */
  order: z.array(z.string()),
  hidden: z.array(z.string()),
});

export type DashboardLayout = z.output<typeof dashboardLayoutSchema>;

export const DASHBOARD_SCOPE = 'dashboard';
export const DEFAULT_LAYOUT: DashboardLayout = { order: [], hidden: [] };

export const widgetKey = (moduleId: string, widgetId: string): string => `${moduleId}:${widgetId}`;

/**
 * Applies the saved order to the currently available widgets. Widgets without a saved position
 * (new modules, new widgets) keep their manifest order and go to the end.
 */
export function orderWidgets<T extends { key: string }>(entries: T[], saved: DashboardLayout): T[] {
  const index = new Map(saved.order.map((k, i) => [k, i]));
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const ia = index.get(a.e.key);
      const ib = index.get(b.e.key);
      if (ia !== undefined && ib !== undefined) return ia - ib;
      if (ia !== undefined) return -1;
      if (ib !== undefined) return 1;
      return a.i - b.i;
    })
    .map((x) => x.e);
}

/** Moves `activeKey` to the position of `overKey`. */
export function moveKey(keys: string[], activeKey: string, overKey: string): string[] {
  const from = keys.indexOf(activeKey);
  const to = keys.indexOf(overKey);
  if (from < 0 || to < 0 || from === to) return keys;
  const next = [...keys];
  next.splice(to, 0, next.splice(from, 1)[0]!);
  return next;
}

/**
 * New saved order after a reorder. Keys of currently unavailable widgets (e.g. a disabled
 * module) are kept at the end so their position survives re-enabling the module.
 */
export function mergeOrder(visibleKeys: string[], saved: DashboardLayout): string[] {
  const known = new Set(visibleKeys);
  return [...visibleKeys, ...saved.order.filter((k) => !known.has(k))];
}

export function toggleHidden(saved: DashboardLayout, key: string): string[] {
  return saved.hidden.includes(key)
    ? saved.hidden.filter((k) => k !== key)
    : [...saved.hidden, key];
}
