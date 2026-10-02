/**
 * Settings registry contract. Core, modules, tools and connectors contribute *sections*; every section
 * belongs to exactly one *category*. The settings page, the search and the command palette are all
 * generated from this list, so nothing can be appended "somewhere at the bottom" of the page.
 */
import type { ReactNode } from 'react';
import type { PlatformKind } from '@/core/platform/types';

/** Route slug of a category: `/settings/<id>`. Order here is the order in the navigation. */
export const SETTINGS_CATEGORY_IDS = [
  'allgemein',
  'darstellung',
  'module',
  'werkzeuge',
  'benachrichtigungen',
  'sicherheit',
  'sync',
  'ki',
  'verbindungen',
  'schnellerfassung',
  'updates',
  'entwickler',
  'ueber',
] as const;
export type SettingsCategoryId = (typeof SETTINGS_CATEGORY_IDS)[number];

export function isCategoryId(id: string | undefined): id is SettingsCategoryId {
  return (SETTINGS_CATEGORY_IDS as readonly string[]).includes(id ?? '');
}

/** What `visibleWhen` can look at. */
export interface SettingsContext {
  platform: PlatformKind;
  /** Dev-Preview build (`isDevBuild()`). */
  isDev: boolean;
  isModuleEnabled(moduleId: string): boolean;
}

/** A single setting inside a section, listed so the search can find it and jump to its row. */
export interface SettingsFieldRef {
  key: string;
  label: string;
  description?: string;
}

export interface SettingsSectionDef {
  /** Anchor id (`/settings/<category>#<id>`); unique across all sections. */
  id: string;
  category: SettingsCategoryId;
  /** Sort order inside the category (then title). */
  order: number;
  title: string;
  description?: string;
  /** Extra search terms (German). */
  keywords?: readonly string[];
  /** Text of the `HelpHint` next to the title. */
  hint?: string;
  fields?: readonly SettingsFieldRef[];
  /** Hidden when this returns false (dev build only, desktop only, module enabled, …). */
  visibleWhen?: (ctx: SettingsContext) => boolean;
  render: () => ReactNode;
}

export interface SettingsCategoryDef {
  id: SettingsCategoryId;
  title: string;
  /** One line, shown in the phone list and used by the search. */
  description: string;
  icon: string;
  keywords?: readonly string[];
}
