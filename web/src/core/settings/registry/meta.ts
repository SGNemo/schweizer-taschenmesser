/**
 * Light placement data of the core sections: where their values live (`scope`) and which sit behind
 * the category's "Erweitert" fold (`level`). No component imports on purpose: the palette and the
 * navigation read this without pulling the section components along. A section can still set
 * `scope`/`level` itself, that wins. Sections without an entry show no scope label and are Basis.
 */
import type { SettingsLevel, SettingsScope, SettingsSectionDef } from './types';

/** Section id → where its values live. Left out = mixed bag or only information (no label). */
const SECTION_SCOPE: Readonly<Record<string, SettingsScope>> = {
  general: 'mixed',
  appearance: 'local',
  reading: 'local',
  focus: 'synced',
  advanced: 'synced',
  favourites: 'synced',
  modules: 'synced',
  tools: 'synced',
  notifications: 'local',
  'calm-reminders': 'synced',
  'browser-extension': 'local',
  sync: 'local',
  backup: 'local',
  'ai-switch': 'mixed',
  'ai-local': 'local',
  'ai-stats': 'local',
  ai: 'local',
  connectors: 'local',
  share: 'local',
  network: 'local',
  shortcuts: 'local',
  localapi: 'local',
  quickcapture: 'local',
  voice: 'local',
  updates: 'local',
  developer: 'local',
  setup: 'local',
  supporter: 'synced',
};

/**
 * Rarely needed sections: shown behind "Erweitert" when their category also has Basis sections.
 * Never anything people look for in a hurry: help, diagnostics, reset, legal texts, sync, backup,
 * the connection log and the Basis/Erweitert switch itself stay in Basis.
 */
const ADVANCED_SECTIONS: ReadonlySet<string> = new Set([
  'ai-local',
  'ai-stats',
  'localapi',
  'model-licenses',
]);

/** Module settings live in the synced `_settings` table. */
const isModuleSection = (id: string) => id.startsWith('module-');

export function scopeOf(s: Pick<SettingsSectionDef, 'id' | 'scope'>): SettingsScope | undefined {
  return s.scope ?? (isModuleSection(s.id) ? 'synced' : SECTION_SCOPE[s.id]);
}

export function levelOf(s: Pick<SettingsSectionDef, 'id' | 'level'>): SettingsLevel {
  return s.level ?? (ADVANCED_SECTIONS.has(s.id) ? 'advanced' : 'basic');
}

/** Ids named in the tables (for the test that they exist). */
export const META_SECTION_IDS: readonly string[] = [
  ...Object.keys(SECTION_SCOPE),
  ...ADVANCED_SECTIONS,
];
