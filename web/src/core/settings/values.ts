/**
 * The allow-list of settings that profiles, the history and the export may read and write: look and
 * feel (device-local, `stores/ui.ts`) and a few synced reminder/focus choices (scope `focus`). One
 * place, one schema per key, so every writer validates the same way. Nothing security related is or
 * can be listed here (vault, auto-lock, keys, tokens, update channel, disk, local API): a test pins it.
 */
import { z } from 'zod';
import { TIME_RE } from '@/core/time/dates';
import {
  ACCENTS,
  COLOR_MODES,
  DENSITIES,
  HOME_VIEWS,
  LEADINGS,
  MOTIONS,
  READ_COVERS,
  READ_SHARES,
  READ_STYLES,
  SIDEBARS,
  TEXT_SIZES,
  useUiStore,
} from '@/stores/ui';
import { getFocusSettings, patchFocusSettings, type FocusSettings } from './focus';

/** Look and feel, device-local. */
const UI_SCHEMA = {
  theme: z.enum(['system', 'light', 'dark']),
  accent: z.enum(ACCENTS),
  textSize: z.enum(TEXT_SIZES),
  leading: z.enum(LEADINGS),
  density: z.enum(DENSITIES),
  motion: z.enum(MOTIONS),
  colorMode: z.enum(COLOR_MODES),
  homeView: z.enum(HOME_VIEWS),
  readAid: z.boolean(),
  sidebar: z.enum(SIDEBARS),
  readShare: z.enum(READ_SHARES),
  readStyle: z.enum(READ_STYLES),
  readCover: z.enum(READ_COVERS),
} as const;

/** Reminder and focus choices, synced scope `focus`. */
const FOCUS_SCHEMA = {
  calmAttention: z.boolean(),
  quietHours: z.boolean(),
  quietFrom: z.string().regex(TIME_RE),
  quietTo: z.string().regex(TIME_RE),
  maxPerHour: z.number().int().min(0).max(20),
  inAppPrompt: z.boolean(),
} as const;

export type UiKey = keyof typeof UI_SCHEMA;
export type FocusKey = keyof typeof FOCUS_SCHEMA & keyof FocusSettings;
export type ValueKey = UiKey | FocusKey;

export const UI_KEYS = Object.keys(UI_SCHEMA) as UiKey[];
export const FOCUS_KEYS = Object.keys(FOCUS_SCHEMA) as FocusKey[];
export const ALL_VALUE_KEYS: readonly ValueKey[] = [...UI_KEYS, ...FOCUS_KEYS];

/** One key's schema (for validating a value from a file or a profile). */
export function schemaOf(key: ValueKey): z.ZodType {
  return (key in UI_SCHEMA ? UI_SCHEMA[key as UiKey] : FOCUS_SCHEMA[key as FocusKey]) as z.ZodType;
}

export const isUiKey = (key: string): key is UiKey => key in UI_SCHEMA;
export const isFocusKey = (key: string): key is FocusKey => key in FOCUS_SCHEMA;

export type Values = Partial<Record<ValueKey, unknown>>;

/** The schema of a values object: only listed keys, every value valid (unknown keys fail). */
export const valuesSchema = z
  .object({ ...UI_SCHEMA, ...FOCUS_SCHEMA })
  .partial()
  .strict();

const ui = () => useUiStore.getState();

/** Writes one look-and-feel value through the store's own setter (applies it right away). */
export function writeUi(key: UiKey, value: unknown): void {
  const s = ui();
  switch (key) {
    case 'theme':
      return s.setTheme(value as never);
    case 'accent':
      return s.setAccent(value as never);
    case 'textSize':
      return s.setTextSize(value as never);
    case 'leading':
      return s.setLeading(value as never);
    case 'density':
      return s.setDensity(value as never);
    case 'motion':
      return s.setMotion(value as never);
    case 'colorMode':
      return s.setColorMode(value as never);
    case 'homeView':
      return s.setHomeView(value as never);
    case 'readAid':
      return s.setReadAid(value as boolean);
    case 'sidebar':
      return s.setSidebar(value as never);
    case 'readShare':
      return s.setReadShare(value as never);
    case 'readStyle':
      return s.setReadStyle(value as never);
    case 'readCover':
      return s.setReadCover(value as never);
  }
}

/** The current value of every key in `keys`. */
export async function readValues(keys: readonly ValueKey[]): Promise<Values> {
  const out: Values = {};
  const state = ui() as unknown as Record<string, unknown>;
  const focusKeys = keys.filter(isFocusKey);
  const focus = focusKeys.length > 0 ? await getFocusSettings() : undefined;
  for (const k of keys) out[k] = isUiKey(k) ? state[k] : focus?.[k as FocusKey];
  return out;
}

/** Writes values (look through the setters, focus choices as one patch). Returns what was there before, for undo. */
export async function writeValues(values: Values): Promise<Values> {
  const keys = Object.keys(values) as ValueKey[];
  const before = await readValues(keys);
  const focusPatch: Record<string, unknown> = {};
  for (const k of keys) {
    if (isUiKey(k)) writeUi(k, values[k]);
    else if (isFocusKey(k)) focusPatch[k] = values[k];
  }
  if (Object.keys(focusPatch).length > 0)
    await patchFocusSettings(focusPatch as Partial<FocusSettings>);
  return before;
}
