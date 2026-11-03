/**
 * Settings export and import: look and feel, reminder choices, profiles and module settings as one
 * JSON file (`nemo-settings` v1) the person saves and opens themselves. Left out on purpose, by
 * construction and pinned by tests: everything of the vault (category Sicherheit), the supporter code,
 * the AI switch, secrets, tokens, sync and server settings (none of those lives in the scopes below),
 * and any value that looks like a web address. Import validates every single value against the same
 * schemas the app uses, ignores what it does not know, shows what would change, and can be undone.
 */
import { z } from 'zod';
import { availableManifests } from '@/core/modules/available';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tSettings3 } from '@/strings.settings3';
import { sameValue } from './changed';
import { comfortSettingsSchema, COMFORT_SCOPE, DEFAULT_COMFORT } from './comfort';
import { CORE_SCOPE, coreSettingsSchema, DEFAULT_CORE } from './core';
import { DEFAULT_FOCUS, FOCUS_SCOPE, focusSettingsSchema } from './focus';
import { applyUndo, recordGroup, withoutHistory, type Undo } from './history';
import { DEFAULT_PROFILES, PROFILES_SCOPE, profilesSettingsSchema } from './profiles';
import { getSettings, setSettings } from './settings';
import {
  isUiKey,
  readValues,
  schemaOf,
  UI_KEYS,
  writeValues,
  type UiKey,
  type Values,
} from './values';

export const TRANSFER_FORMAT = 'nemo-settings';
export const TRANSFER_VERSION = 1;

export interface TransferFile {
  format: typeof TRANSFER_FORMAT;
  version: number;
  exportedAt: string;
  /** Look and feel (device-local on the source device). */
  values: Record<string, unknown>;
  /** Synced scopes: `core`, `focus`, `comfort`, `profiles`, `module.<id>`. */
  scopes: Record<string, Record<string, unknown>>;
}

interface ScopeDef {
  scope: string;
  schema: z.ZodObject;
  defaults: Record<string, unknown>;
}

/** The scopes a file may carry. Modules of the category Sicherheit (the vault) are never among them. */
function scopeDefs(): ScopeDef[] {
  const fixed: ScopeDef[] = [
    { scope: CORE_SCOPE, schema: coreSettingsSchema, defaults: DEFAULT_CORE },
    { scope: FOCUS_SCOPE, schema: focusSettingsSchema, defaults: DEFAULT_FOCUS },
    { scope: COMFORT_SCOPE, schema: comfortSettingsSchema, defaults: DEFAULT_COMFORT },
    { scope: PROFILES_SCOPE, schema: profilesSettingsSchema, defaults: DEFAULT_PROFILES },
  ];
  const modules = availableManifests()
    .filter(
      (m) => m.settings.fields.length > 0 && (m.settings.category ?? 'module') !== 'sicherheit',
    )
    .map((m) => ({
      scope: `module.${m.id}`,
      schema: m.settings.schema,
      defaults: m.settings.defaults,
    }));
  return [...fixed, ...modules];
}

const URLISH = /^\s*(https?|wss?|ftp):\/\//i;

/** Drops values that look like a web address (also inside lists and objects): no server or host leaves with the file. */
export function dropUrls(value: unknown): unknown {
  if (typeof value === 'string') return URLISH.test(value) ? undefined : value;
  if (Array.isArray(value)) return value.map(dropUrls).filter((v) => v !== undefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([k, v]) => [k, dropUrls(v)] as const)
        .filter(([, v]) => v !== undefined),
    );
  }
  return value;
}

/** The current effective settings (defaults filled in) of one scope. */
async function current(def: ScopeDef): Promise<Record<string, unknown>> {
  return (await getSettings(def.scope, def.schema, def.defaults)) as Record<string, unknown>;
}

export async function buildExport(): Promise<TransferFile> {
  const scopes: TransferFile['scopes'] = {};
  for (const def of scopeDefs()) {
    const values = dropUrls(await current(def)) as Record<string, unknown>;
    if (Object.keys(values).length > 0) scopes[def.scope] = values;
  }
  return {
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    exportedAt: new Date(now()).toISOString(),
    values: (await readValues(UI_KEYS)) as Record<string, unknown>,
    scopes,
  };
}

const fileSchema = z.object({
  format: z.literal(TRANSFER_FORMAT),
  version: z.number().int().min(1),
  exportedAt: z.string().optional(),
  values: z.record(z.string(), z.unknown()).default({}),
  scopes: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
});

export type ParseResult =
  { ok: true; file: TransferFile } | { ok: false; error: 'format' | 'version' };

export function parseTransfer(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'format' };
  }
  const parsed = fileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'format' };
  if (parsed.data.version > TRANSFER_VERSION) return { ok: false, error: 'version' };
  return { ok: true, file: { exportedAt: '', ...parsed.data } };
}

/** One setting the file would change. */
export interface ChangeLine {
  scope: string;
  key: string;
  before: unknown;
  after: unknown;
}

/** What importing the file would change: only known, valid, non-address values that differ from now. */
export async function planImport(file: TransferFile): Promise<ChangeLine[]> {
  const lines: ChangeLine[] = [];
  const nowUi = await readValues(UI_KEYS);
  for (const [key, after] of Object.entries(file.values)) {
    if (!isUiKey(key) || !schemaOf(key).safeParse(after).success) continue;
    if (!sameValue(nowUi[key], after)) lines.push({ scope: 'ui', key, before: nowUi[key], after });
  }
  for (const def of scopeDefs()) {
    const incoming = file.scopes[def.scope];
    if (!incoming) continue;
    const now_ = await current(def);
    for (const [key, after] of Object.entries(incoming)) {
      const shape = def.schema.shape[key];
      if (!shape || !shape.safeParse(after).success || dropUrls(after) === undefined) continue;
      if (!sameValue(now_[key], after))
        lines.push({ scope: def.scope, key, before: now_[key], after });
    }
  }
  return lines;
}

/** Writes the planned lines, records one history entry and offers to take it all back. Returns how many were written. */
export async function applyImport(lines: readonly ChangeLine[]): Promise<number> {
  if (lines.length === 0) return 0;
  const ui: Values = {};
  const scopes: Record<string, Record<string, unknown>> = {};
  const undo: Undo = { values: {}, scopes: {} };
  for (const l of lines) {
    if (l.scope === 'ui') {
      ui[l.key as UiKey] = l.after;
      (undo.values as Values)[l.key as UiKey] = l.before;
    } else {
      (scopes[l.scope] ??= {})[l.key] = l.after;
      ((undo.scopes as Record<string, Record<string, unknown>>)[l.scope] ??= {})[l.key] = l.before;
    }
  }
  await withoutHistory(async () => {
    if (Object.keys(ui).length > 0) await writeValues(ui);
    for (const def of scopeDefs()) {
      const patch = scopes[def.scope];
      if (patch) await setSettings(def.scope, patch, def.defaults);
    }
  });
  recordGroup(tSettings3.get().history.import(lines.length), undo);
  const x = tSettings3.get().transfer;
  useUiStore.getState().toast(x.applied(lines.length), {
    label: t.ui.undo,
    run: () => void applyUndo(undo),
  });
  return lines.length;
}
