import { z } from 'zod';
import { ALL_WIDGET_SIZES, type WidgetSize } from '@/core/modules/types';
import { settingsRepo } from '@/core/settings/settings';
import { useLiveQuery } from 'dexie-react-hooks';

/**
 * Home-screen configuration, one record in the synced `_settings` table (scope "home"). One layout
 * for all devices; the grid adapts to the width of the page, not the stored data.
 */
export const homeLayoutSchema = z.object({
  /** Widget keys (`<moduleId>:<widgetId>`) in display order. */
  order: z.array(z.string()),
  /** Keys hidden on the home screen. Hiding never deactivates the module. */
  hidden: z.array(z.string()),
  /** Chosen size per key; missing = the widget's `defaultSize`. */
  sizes: z.record(z.string(), z.enum(ALL_WIDGET_SIZES as [WidgetSize, ...WidgetSize[]])),
});

export type HomeLayout = z.output<typeof homeLayoutSchema>;

export const HOME_SCOPE = 'home';
/** The scope used before the home screen existed ("Übersicht" customisation); migrated, not deleted. */
export const LEGACY_DASHBOARD_SCOPE = 'dashboard';
export const DEFAULT_LAYOUT: HomeLayout = { order: [], hidden: [], sizes: {} };

export const widgetKey = (moduleId: string, widgetId: string): string => `${moduleId}:${widgetId}`;

const legacySchema = z.object({
  order: z.array(z.string()).catch([]),
  hidden: z.array(z.string()).catch([]),
});

/** Turns the stored legacy dashboard values (order, hidden) into the home layout. */
export function migrateLegacyLayout(legacy: Record<string, unknown> | undefined): HomeLayout {
  const parsed = legacySchema.safeParse(legacy ?? {});
  return parsed.success ? { ...parsed.data, sizes: {} } : DEFAULT_LAYOUT;
}

/** Widget keys of modules that were merged into another one (Systeminfo → "Dieser PC"). */
export const LEGACY_WIDGET_KEYS: Readonly<Record<string, string>> = {
  'system:status': 'disk:system',
};

function mapLegacyKeys(layout: HomeLayout): HomeLayout {
  const map = (keys: string[]) => [...new Set(keys.map((k) => LEGACY_WIDGET_KEYS[k] ?? k))];
  const sizes = Object.fromEntries(
    Object.entries(layout.sizes).map(([k, v]) => [LEGACY_WIDGET_KEYS[k] ?? k, v]),
  );
  return { order: map(layout.order), hidden: map(layout.hidden), sizes };
}

/** The stored home layout; falls back to the legacy dashboard record until the first edit. */
export function resolveLayout(
  home: Record<string, unknown> | undefined,
  legacy: Record<string, unknown> | undefined,
): HomeLayout {
  if (home) {
    const parsed = homeLayoutSchema.safeParse({ ...DEFAULT_LAYOUT, ...home });
    return parsed.success ? mapLegacyKeys(parsed.data) : DEFAULT_LAYOUT;
  }
  return mapLegacyKeys(migrateLegacyLayout(legacy));
}

export async function loadLayout(): Promise<HomeLayout> {
  const [home, legacy] = await Promise.all([
    settingsRepo.get(HOME_SCOPE),
    settingsRepo.get(LEGACY_DASHBOARD_SCOPE),
  ]);
  return resolveLayout(home, legacy);
}

/** Live layout; `undefined` until loaded. */
export const useHomeLayout = (): HomeLayout | undefined => useLiveQuery(() => loadLayout(), []);

/** Writes the complete layout (so the first edit also completes the migration). */
export async function saveLayout(layout: HomeLayout): Promise<void> {
  await settingsRepo.upsert(HOME_SCOPE, homeLayoutSchema.parse(layout));
}

/** Patches the layout on top of what is stored (or migrated). */
export async function updateLayout(patch: Partial<HomeLayout>): Promise<void> {
  await saveLayout({ ...(await loadLayout()), ...patch });
}

/** Back to the defaults: manifest order, everything visible, default sizes. */
export const resetLayout = (): Promise<void> => saveLayout(DEFAULT_LAYOUT);

/** Default first positions of widgets without a saved position: "Jetzt dran", then the time to the next appointment. */
export const FRONT_WIDGETS: readonly string[] = ['todos:next', 'calendar:next'];

/**
 * Applies the saved order to the currently available widgets. Widgets without a saved position
 * (new modules, new widgets) keep their manifest order and go to the end.
 */
export function orderWidgets<T extends { key: string }>(entries: T[], saved: HomeLayout): T[] {
  const index = new Map(saved.order.map((k, i) => [k, i]));
  // Widgets that start the day come first until the user moves them (no saved position yet).
  const front = (k: string) => {
    const f = FRONT_WIDGETS.indexOf(k);
    return f < 0 ? FRONT_WIDGETS.length : f;
  };
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const ia = index.get(a.e.key);
      const ib = index.get(b.e.key);
      if (ia !== undefined && ib !== undefined) return ia - ib;
      if (ia !== undefined) return -1;
      if (ib !== undefined) return 1;
      return front(a.e.key) - front(b.e.key) || a.i - b.i;
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
export function mergeOrder(visibleKeys: string[], saved: HomeLayout): string[] {
  const known = new Set(visibleKeys);
  return [...visibleKeys, ...saved.order.filter((k) => !known.has(k))];
}

export function toggleHidden(saved: HomeLayout, key: string): string[] {
  return saved.hidden.includes(key)
    ? saved.hidden.filter((k) => k !== key)
    : [...saved.hidden, key];
}

/** The size to render: the user's choice if the widget still offers it, else its default. */
export function effectiveSize(
  w: { sizes: readonly WidgetSize[]; defaultSize: WidgetSize },
  key: string,
  saved: HomeLayout,
): WidgetSize {
  const chosen = saved.sizes[key];
  return chosen && w.sizes.includes(chosen) ? chosen : w.defaultSize;
}

/** Size picked in the edit mode; the default size is stored as "no choice". */
export function withSize(
  saved: HomeLayout,
  key: string,
  size: WidgetSize,
  defaultSize: WidgetSize,
): Record<string, WidgetSize> {
  const { [key]: _drop, ...rest } = saved.sizes;
  void _drop;
  return size === defaultSize ? rest : { ...rest, [key]: size };
}
