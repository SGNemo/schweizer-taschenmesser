/**
 * Setup profiles: presets of modules and tools. Pure – the wizard shows the resulting diff and
 * only then writes anything.
 */
import type { ToolManifest } from '@/core/tools/types';

export interface Profile {
  /** Texts: `t.setup.profiles[id]`. */
  id: string;
  modules: readonly string[];
  /** Non-dev tools to switch on; every other non-dev tool is switched off. */
  tools: readonly string[];
}

export const PROFILES: readonly Profile[] = [
  {
    id: 'everyday',
    modules: ['calendar', 'todos', 'reminders', 'lists', 'notes', 'people'],
    tools: ['calc', 'timer', 'units', 'dates', 'qr'],
  },
  {
    id: 'finance',
    modules: ['finance', 'budgets', 'subscriptions', 'invoices', 'vault', 'calendar', 'reminders'],
    tools: ['calc', 'currency'],
  },
  {
    id: 'productive',
    modules: ['todos', 'notes', 'calendar', 'bookmarks'],
    tools: ['timer', 'calc', 'dates'],
  },
  {
    id: 'minimal',
    modules: ['calendar', 'todos'],
    tools: ['calc'],
  },
];

export interface ModuleInfo {
  id: string;
  requires?: readonly string[];
}

/** `ids` plus everything they build on (transitively). Unknown ids are dropped. */
export function withDependencies(
  ids: Iterable<string>,
  infos: readonly ModuleInfo[],
): { ids: Set<string>; viaDependency: Record<string, string[]> } {
  const byId = new Map(infos.map((i) => [i.id, i]));
  const out = new Set<string>();
  const via: Record<string, string[]> = {};
  const visit = (id: string, from?: string) => {
    const info = byId.get(id);
    if (!info) return;
    if (from) {
      const list = (via[id] ??= []);
      if (!list.includes(from)) list.push(from);
    }
    if (out.has(id)) return;
    out.add(id);
    for (const dep of info.requires ?? []) visit(dep, id);
  };
  for (const id of ids) visit(id);
  return { ids: out, viaDependency: via };
}

/** Switching a module on pulls in what it builds on; switching one off drops its dependents. */
export function toggleModule(
  selection: ReadonlySet<string>,
  id: string,
  on: boolean,
  infos: readonly ModuleInfo[],
): Set<string> {
  if (on) return withDependencies([...selection, id], infos).ids;
  const next = new Set(selection);
  next.delete(id);
  // Dependents cannot stay without it; repeat until stable (chains of requirements).
  for (let changed = true; changed;) {
    changed = false;
    for (const info of infos) {
      if (next.has(info.id) && (info.requires ?? []).some((r) => !next.has(r))) {
        next.delete(info.id);
        changed = true;
      }
    }
  }
  return next;
}

export interface SelectionDiff {
  enable: string[];
  disable: string[];
}

export function diffSelection(
  current: ReadonlySet<string>,
  target: ReadonlySet<string>,
): SelectionDiff {
  return {
    enable: [...target].filter((id) => !current.has(id)),
    disable: [...current].filter((id) => !target.has(id)),
  };
}

export interface ProfileResult {
  modules: Set<string>;
  tools: Set<string>;
  viaDependency: Record<string, string[]>;
}

/** The target state of a profile: its modules plus dependencies, and its (non-dev) tools. */
export function resolveProfile(
  profile: Profile,
  infos: readonly ModuleInfo[],
  tools: readonly Pick<ToolManifest, 'id'>[],
): ProfileResult {
  const { ids, viaDependency } = withDependencies(profile.modules, infos);
  const known = new Set(tools.map((t) => t.id));
  return {
    modules: ids,
    tools: new Set(profile.tools.filter((id) => known.has(id))),
    viaDependency,
  };
}
