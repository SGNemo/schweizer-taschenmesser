import { compareText } from '@/core/i18n/format';
import type { PileEntry } from './pile';
import { NEVER_LINKED, refKey, type EntityRef } from '@/core/entitylinks/types';
import { loadModuleStates, useModuleStates } from './activation';
import { availableManifests } from '@/core/modules/available';
import { useSharedLiveQuery } from './sharedQuery';
import { noteSource } from '@/core/notifications/source';
import { today } from '@/core/time/now';
import type {
  AttentionItem,
  CalendarItem,
  DateRange,
  DueNotification,
  HeadlineFigure,
  ModuleHue,
  ModuleManifest,
  PlanBlock,
  PlannableItem,
  ResolvedState,
} from './types';

/** Loads the lazy sources of one contribution kind, so a live query over them starts with them cached. */
const preload =
  (
    kind: 'calendarItems' | 'notifications' | 'attention' | 'headline' | 'plannable' | 'linkTarget',
    manifests: readonly ModuleManifest[],
  ) =>
  () =>
    Promise.all(manifests.map((m) => m.contributions?.[kind]?.() ?? undefined));

export function compareCalendarItems(a: CalendarItem, b: CalendarItem): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1; // all-day first
  const ta = a.time ?? '';
  const tb = b.time ?? '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return compareText(a.title, b.title);
}

/** Calendar items from all given (active) modules. A failing module never breaks the others. */
export async function collectCalendarItems(
  range: DateRange,
  manifests: readonly ModuleManifest[],
): Promise<CalendarItem[]> {
  const lists = await Promise.all(
    manifests.map(async (m) => {
      const load = m.contributions?.calendarItems;
      if (!load) return [];
      try {
        return await (await load()).default(range);
      } catch (e) {
        console.error(`[calendar] source "${m.id}" failed`, e);
        return [];
      }
    }),
  );
  return lists.flat().sort(compareCalendarItems);
}

/** What the planner may plan, with the module that offered it. */
export type PlannableEntry = PlannableItem & { moduleId: string };

/** Module id → the ids of that module the person asked into the plan (the planner's item rows; CONCEPT-SOURCES §3.3). */
export type RequestedIds = Readonly<Record<string, readonly string[]>>;

/**
 * Plannable things of all given (active) modules, in manifest order. A failing source never breaks
 * the others; the planner reaches the write-back of a source through `plannableSource`. `requested` reaches
 * each source as `ctx.requested` (its own ids only): a thing without a date is listed only when asked for.
 */
export async function collectPlannable(
  ctx: { today: string; until: string },
  manifests: readonly ModuleManifest[],
  requested?: RequestedIds,
): Promise<PlannableEntry[]> {
  const lists = await Promise.all(
    manifests.map(async (m) => {
      const load = m.contributions?.plannable;
      if (!load) return [];
      const asked = requested?.[m.id];
      const own = asked?.length ? { ...ctx, requested: [...asked] } : ctx;
      try {
        return (await (await load()).default.list(own)).map((i) => ({ ...i, moduleId: m.id }));
      } catch (e) {
        console.error(`[plannable] source "${m.id}" failed`, e);
        return [];
      }
    }),
  );
  return lists.flat();
}

/** Live plannable things of all active modules; `undefined` while loading. `requested`: see `collectPlannable`. */
export function usePlannable(
  ctx: { today: string; until: string },
  requested?: RequestedIds,
): PlannableEntry[] | undefined {
  const states = useModuleStates();
  const ids = activeManifests(states)
    .map((m) => m.id)
    .join(',');
  const asked = requested ? JSON.stringify(requested) : '';
  return useSharedLiveQuery(
    `plannable|${ctx.today}|${ctx.until}|${ids}|${states === undefined}|${asked}`,
    async () => (states ? collectPlannable(ctx, activeManifests(states), requested) : undefined),
    preload('plannable', activeManifests(states)),
  );
}

/**
 * The parts of the planner's collective rows (planner hub 2, package 2) of all given (active) modules, in manifest
 * order. A failing part is missing; the others stay. Never `accounts`.
 */
export async function collectPiles(
  ctx: { today: string; until: string },
  manifests: readonly ModuleManifest[],
): Promise<PileEntry[]> {
  const lists = await Promise.all(
    manifests.map(async (m) => {
      const load = m.contributions?.pile;
      if (!load || m.id === 'accounts') return [];
      try {
        return (await (await load()).default(ctx)).map((p) => ({ ...p, moduleId: m.id }));
      } catch (e) {
        console.error(`[pile] source "${m.id}" failed`, e);
        return [];
      }
    }),
  );
  return lists.flat();
}

/** A block of time a module keeps free (`PlannableSource.blocks`), with the module that asked for it. */
export type PlanBlockEntry = PlanBlock & { moduleId: string };

/**
 * Blocks of time of all given (active) modules (habits: „Zeit im Plan freihalten“, planner hub S4), in manifest
 * order. A failing source never breaks the others; a block outside the range is dropped.
 */
export async function collectPlanBlocks(
  ctx: { today: string; until: string },
  manifests: readonly ModuleManifest[],
): Promise<PlanBlockEntry[]> {
  const lists = await Promise.all(
    manifests.map(async (m) => {
      const load = m.contributions?.plannable;
      if (!load) return [];
      try {
        const source = (await load()).default;
        if (!source.blocks) return [];
        return (await source.blocks(ctx))
          .filter((b) => b.date >= ctx.today && b.date <= ctx.until && b.min > 0)
          .map((b) => ({ ...b, moduleId: m.id }));
      } catch (e) {
        console.error(`[plannable] blocks of "${m.id}" failed`, e);
        return [];
      }
    }),
  );
  return lists.flat();
}

/** Live blocks of time of all active modules; `undefined` while loading. */
export function usePlanBlocks(ctx: { today: string; until: string }): PlanBlockEntry[] | undefined {
  const states = useModuleStates();
  const ids = activeManifests(states)
    .map((m) => m.id)
    .join(',');
  return useSharedLiveQuery(
    `planBlocks|${ctx.today}|${ctx.until}|${ids}|${states === undefined}`,
    async () => (states ? collectPlanBlocks(ctx, activeManifests(states)) : undefined),
    preload('plannable', activeManifests(states)),
  );
}

/** Loads the plannable source of one module (for `onAssign`/`onDone`/`onEstimate`); `undefined` without one. */
export async function plannableSource(manifest: ModuleManifest | undefined) {
  const load = manifest?.contributions?.plannable;
  return load ? (await load()).default : undefined;
}

/** Notifications due in (from, to] from all given (active) modules, oldest first. */
/**
 * The address a link falls back to where its module cannot answer (off, or not on this platform): only a mail
 * thread has one – the provider's web mail, without any account. The id is untrusted; nothing is requested.
 */
async function fallbackUrl(ref: EntityRef): Promise<string | undefined> {
  if (ref.module !== 'mail') return undefined;
  const { mailThreadUrl, safeThreadId } = await import('@/core/mail/service');
  const id = safeThreadId(ref.id);
  return id ? mailThreadUrl(id) : undefined;
}

/**
 * What a link's target is on this device (docs/design/planner-hub/CONCEPT-LINKS.md §1.1, §1.4) – the one reader
 * of `contributions.linkTarget`. Core answers by itself, without calling a module: `gone` for the vault and for an
 * id that cannot be a record id; `unavailable` (with the fallback address, if any) while the target module is
 * unknown, not on this platform or switched off. A module without a resolver is `gone`. Never throws: a failing
 * resolver reads as `elsewhere` (it cannot be told) – never as `gone`, which would offer to remove the link.
 */
export async function resolveLink(
  ref: EntityRef,
  manifests: readonly ModuleManifest[] = availableManifests(),
): Promise<ResolvedState> {
  if (ref.module === NEVER_LINKED) return { state: 'gone' };
  // A record id is capped at 128 characters everywhere (`core/sync/crypto.ts`); anything else names nothing.
  if (typeof ref.id !== 'string' || ref.id === '' || ref.id.length > 128) return { state: 'gone' };
  // Only a registry id is ever logged: `ref.module` is a stored string from outside.
  let known: string | undefined;
  try {
    const manifest = manifests.find((m) => m.id === ref.module);
    known = manifest?.id;
    if (!manifest || !(await loadModuleStates(manifests))[manifest.id]) {
      const url = await fallbackUrl(ref);
      return { state: 'unavailable', ...(url ? { url } : {}) };
    }
    const load = manifest.contributions?.linkTarget;
    if (!load) return { state: 'gone' };
    return await (await load()).default.resolve(ref.id);
  } catch (e) {
    console.error(`[linkTarget] "${known ?? 'unknown module'}" failed`, e);
    return { state: 'elsewhere' };
  }
}

/**
 * Live states of several links by `refKey`; `undefined` while loading. Follows the targets (a deleted note turns
 * `gone`) and the module switches. A map, not a list: while another set of refs loads, the previous answer stays,
 * and it is still right for every key it holds.
 */
export function useResolvedLinks(
  refs: readonly EntityRef[],
): ReadonlyMap<string, ResolvedState> | undefined {
  const key = JSON.stringify(refs.map((r) => [r.module, r.id]));
  return useSharedLiveQuery(
    `links|${key}`,
    async () =>
      new Map(await Promise.all(refs.map(async (r) => [refKey(r), await resolveLink(r)] as const))),
    async () => {
      const modules = new Set(refs.map((r) => r.module));
      modules.delete(NEVER_LINKED);
      if (modules.has('mail')) await import('@/core/mail/service');
      await preload(
        'linkTarget',
        availableManifests().filter((m) => modules.has(m.id)),
      )();
    },
  );
}

export async function collectNotifications(
  range: { from: number; to: number },
  manifests: readonly ModuleManifest[],
): Promise<DueNotification[]> {
  const lists = await Promise.all(
    manifests.map(async (m) => {
      const load = m.contributions?.notifications;
      if (!load) return [];
      try {
        const items = await (await load()).default(range);
        for (const n of items) noteSource(n.key, m.id);
        return items;
      } catch (e) {
        console.error(`[notifications] source "${m.id}" failed`, e);
        return [];
      }
    }),
  );
  return lists.flat().sort((a, b) => a.at - b.at);
}

export function activeManifests(states: Record<string, boolean> | undefined): ModuleManifest[] {
  return states ? availableManifests().filter((m) => states[m.id]) : [];
}

/** Live calendar items of all active modules for a date range; `undefined` while loading. */
export function useCalendarItems(range: DateRange): CalendarItem[] | undefined {
  const states = useModuleStates();
  const ids = activeManifests(states)
    .map((m) => m.id)
    .join(',');
  // One shared query per range and module set: the home page mounts this hook several times.
  return useSharedLiveQuery(
    `calendar|${range.from}|${range.to}|${ids}|${states === undefined}`,
    async () => (states ? collectCalendarItems(range, activeManifests(states)) : undefined),
    preload('calendarItems', activeManifests(states)),
  );
}

const TONE_ORDER: Record<AttentionItem['tone'], number> = { danger: 0, accent: 1, warning: 2 };

/**
 * Danger first, then accent, then warning; by rank and title inside a tone. Not capped: the overview shows
 * everything that is overdue or due today and counts the rest in "Kann warten · n", so a cut here would make
 * that number wrong. A caller with little room passes its own `limit` (`NowStrip`).
 */
export function rankAttention(items: readonly AttentionItem[], limit = Number.POSITIVE_INFINITY) {
  return [...items]
    .sort(
      (a, b) =>
        TONE_ORDER[a.tone] - TONE_ORDER[b.tone] ||
        (a.rank ?? 100) - (b.rank ?? 100) ||
        compareText(a.title, b.title),
    )
    .slice(0, limit);
}

/** "Jetzt wichtig" items of all given (active) modules. A failing module never breaks the others. */
export async function collectAttention(
  day: string,
  manifests: readonly ModuleManifest[],
): Promise<AttentionItem[]> {
  const lists = await Promise.all(
    manifests.map(async (m) => {
      const load = m.contributions?.attention;
      if (!load) return [];
      try {
        return await (await load()).default({ today: day });
      } catch (e) {
        console.error(`[attention] source "${m.id}" failed`, e);
        return [];
      }
    }),
  );
  return rankAttention(lists.flat());
}

/**
 * Live attention items; `undefined` while loading. `only` limits the sources to these modules (a module page's
 * "Jetzt" row needs its own, not the code and queries of every module).
 */
export function useAttentionItems(only?: readonly string[]): AttentionItem[] | undefined {
  const states = useModuleStates();
  const sources = activeManifests(states).filter((m) => !only || only.includes(m.id));
  const ids = sources.map((m) => m.id).join(',');
  return useSharedLiveQuery(
    `attention|${ids}|${states === undefined}`,
    async () => (states ? collectAttention(today(), sources) : undefined),
    preload('attention', sources),
  );
}

/** Large figures of all given (active) modules for the cockpit, in manifest order; a failing module is skipped. */
export async function collectHeadlines(
  day: string,
  manifests: readonly ModuleManifest[],
): Promise<(HeadlineFigure & { moduleId: string; hue: ModuleHue })[]> {
  const figures = await Promise.all(
    manifests.map(async (m) => {
      const load = m.contributions?.headline;
      if (!load) return undefined;
      try {
        const figure = await (await load()).default({ today: day });
        return figure ? { ...figure, moduleId: m.id, hue: m.identity.hue } : undefined;
      } catch (e) {
        console.error(`[headline] source "${m.id}" failed`, e);
        return undefined;
      }
    }),
  );
  return figures.filter((f) => f !== undefined);
}

/** Live headline figures; `undefined` while loading. */
export function useHeadlines():
  (HeadlineFigure & { moduleId: string; hue: ModuleHue })[] | undefined {
  const states = useModuleStates();
  const ids = activeManifests(states)
    .map((m) => m.id)
    .join(',');
  return useSharedLiveQuery(
    `headline|${ids}|${states === undefined}`,
    async () => (states ? collectHeadlines(today(), activeManifests(states)) : undefined),
    preload('headline', activeManifests(states)),
  );
}
