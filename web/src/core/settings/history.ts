/**
 * Change history: the last 30 changes of settings on this device, each with what it took to put it
 * back. Device-local (`tm-settings-history`), off with one switch, never holds anything from the
 * vault, supporter, AI switch or secrets (`isRecorded`). Two central hooks instead of a call in every
 * setter: a subscription on the look-and-feel store and the observer seam in `setSettings`. A profile
 * switch or an import writes many keys and shows as one entry (`recordGroup`).
 */
import { useSyncExternalStore } from 'react';
import { availableManifests } from '@/core/modules/available';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tSettings3 } from '@/strings.settings3';
import { setChangeListener, setSettings } from './settings';
import { UI_KEYS, writeValues, type Values } from './values';

const KEY = 'tm-settings-history';
const ON_KEY = 'tm-settings-history-on';
export const MAX_ENTRIES = 30;

/** What it takes to put a change back: look/focus values and/or scope patches. */
export interface Undo {
  values?: Values;
  scopes?: Record<string, Record<string, unknown>>;
}

export interface HistoryEntry {
  id: string;
  at: number;
  label: string;
  undo: Undo;
}

/** Scopes whose changes are never written down (security, identity, AI privacy). */
export function isRecorded(scope: string): boolean {
  return !(
    scope === 'supporter' ||
    scope === 'ai.switch' ||
    scope === 'profiles' ||
    scope === 'module.accounts' ||
    scope.startsWith('_') ||
    /secret|token|key/i.test(scope)
  );
}

const listeners = new Set<() => void>();
let snapshot = '';

function notify(): void {
  snapshot = '';
  for (const l of listeners) l();
}

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

export function readHistory(): HistoryEntry[] {
  try {
    const raw: unknown = JSON.parse(readRaw());
    return Array.isArray(raw)
      ? raw.filter(
          (e): e is HistoryEntry =>
            !!e &&
            typeof e === 'object' &&
            typeof e.id === 'string' &&
            typeof e.label === 'string' &&
            typeof e.at === 'number' &&
            !!e.undo,
        )
      : [];
  } catch {
    return [];
  }
}

function write(entries: readonly HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // storage blocked: the history simply stays empty
  }
  notify();
}

export function isHistoryOn(): boolean {
  try {
    return localStorage.getItem(ON_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setHistoryOn(on: boolean): void {
  try {
    if (on) localStorage.removeItem(ON_KEY);
    else localStorage.setItem(ON_KEY, 'off');
  } catch {
    // storage blocked
  }
  notify();
}

export function clearHistory(): void {
  write([]);
}

let suppressed = 0;

/** Runs `fn` without writing history (undo itself, or a group that records one entry on its own). */
export async function withoutHistory<T>(fn: () => Promise<T>): Promise<T> {
  suppressed++;
  try {
    return await fn();
  } finally {
    suppressed--;
  }
}

let counter = 0;
const nextId = () => `h-${now().toString(36)}-${(counter++).toString(36)}`;

function push(label: string, undo: Undo): void {
  if (suppressed > 0 || !isHistoryOn()) return;
  write([{ id: nextId(), at: now(), label, undo }, ...readHistory()]);
}

/** One entry for several writes at once (a profile switch, an import). */
export function recordGroup(label: string, undo: Undo): void {
  push(label, undo);
}

/* ---- wording ---- */

const text = (v: unknown): string => {
  const h = tSettings3.get().history;
  if (typeof v === 'boolean') return v ? h.on_ : h.off_;
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 40 ? `${s.slice(0, 39)}…` : s;
};

function valueText(key: string, v: unknown): string {
  const o = t.settings;
  const maps: Record<string, Record<string, string> | undefined> = {
    theme: { system: o.themeSystem, light: o.themeLight, dark: o.themeDark },
    density: o.densityOptions,
    colorMode: o.colorOptions,
    homeView: o.homeViewOptions,
  };
  const mapped = maps[key]?.[String(v)];
  return mapped ?? text(v);
}

function labelOf(scope: string, key: string): string {
  const keys = tSettings3.get().history.keys as Record<string, string>;
  const moduleId = scope.startsWith('module.') ? scope.slice('module.'.length) : undefined;
  if (moduleId) {
    const m = availableManifests().find((x) => x.id === moduleId);
    const f = m?.settings.fields.find((x) => x.key === key);
    if (m && f) return `${m.name}: ${f.label}`;
  }
  return keys[key] ?? key;
}

function moduleValueText(scope: string, key: string, v: unknown): string {
  const moduleId = scope.startsWith('module.') ? scope.slice('module.'.length) : undefined;
  const f = moduleId
    ? availableManifests()
        .find((x) => x.id === moduleId)
        ?.settings.fields.find((x) => x.key === key)
    : undefined;
  return f?.options?.find((o) => o.value === String(v))?.label ?? valueText(key, v);
}

/* ---- hooks ---- */

/** Starts recording; returns the stop function. Called once at app start. */
export function startHistory(): () => void {
  setChangeListener((scope, key, before, after) => {
    if (!isRecorded(scope)) return;
    const h = tSettings3.get().history;
    push(
      h.changed(
        labelOf(scope, key),
        moduleValueText(scope, key, before),
        moduleValueText(scope, key, after),
      ),
      {
        scopes: { [scope]: { [key]: before } },
      },
    );
  });
  const unsubscribe = useUiStore.subscribe((state, prev) => {
    const s = state as unknown as Record<string, unknown>;
    const p = prev as unknown as Record<string, unknown>;
    for (const key of UI_KEYS) {
      if (s[key] === p[key]) continue;
      const h = tSettings3.get().history;
      push(h.changed(labelOf('ui', key), valueText(key, p[key]), valueText(key, s[key])), {
        values: { [key]: p[key] },
      });
    }
  });
  return () => {
    setChangeListener(undefined);
    unsubscribe();
  };
}

/** Writes an undo payload back, without recording it again. */
export async function applyUndo(undo: Undo): Promise<void> {
  await withoutHistory(async () => {
    if (undo.values) await writeValues(undo.values);
    for (const [scope, patch] of Object.entries(undo.scopes ?? {})) {
      // Profiles are not written down one by one, but an import's undo does carry them.
      if (isRecorded(scope) || scope === 'profiles') await setSettings(scope, patch);
    }
  });
}

/** Puts one entry's change back (not recorded again) and removes the entry. */
export async function undoEntry(id: string): Promise<void> {
  const entry = readHistory().find((e) => e.id === id);
  if (!entry) return;
  await applyUndo(entry.undo);
  write(readHistory().filter((e) => e.id !== id));
}

/** The history for components, newest first. */
export function useHistory(): HistoryEntry[] {
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => (snapshot ||= readRaw()),
    () => '[]',
  );
  void raw;
  return readHistory();
}
