import type { SettingsCategoryId } from './types';

/** Section ids of module settings are `module-<moduleId>`. */
export const MODULE_SECTION_PREFIX = 'module-';

/** Module id of a module section id (only for the "Module" category), else undefined. */
export function moduleIdOfSection(
  category: SettingsCategoryId,
  sectionId: string | undefined,
): string | undefined {
  return category === 'module' && sectionId?.startsWith(MODULE_SECTION_PREFIX)
    ? sectionId.slice(MODULE_SECTION_PREFIX.length)
    : undefined;
}

/** `/settings/<category>#<section>[--<field>]` – the one way to link into the settings. */
export function settingsPath(
  category: SettingsCategoryId,
  sectionId?: string,
  fieldKey?: string,
): string {
  // A module's settings are a page of their own: `/settings/module/<id>#module-<id>[--<field>]` (the hash highlights the head or the row).
  const moduleId = moduleIdOfSection(category, sectionId);
  if (moduleId) {
    return `/settings/module/${moduleId}#${sectionId}${fieldKey ? `--${fieldKey}` : ''}`;
  }
  const hash = sectionId ? `#${sectionId}${fieldKey ? `--${fieldKey}` : ''}` : '';
  return `/settings/${category}${hash}`;
}

/** Anchors of the old single-page settings (`/settings#sync`) and where they live now. */
export const LEGACY_HASHES: Readonly<Record<string, SettingsCategoryId>> = {
  setup: 'ueber',
  appearance: 'darstellung',
  favourites: 'darstellung',
  notifications: 'benachrichtigungen',
  ai: 'ki',
  sync: 'sync',
  backup: 'sync',
  connectors: 'verbindungen',
  localapi: 'verbindungen',
  quickcapture: 'schnellerfassung',
  updates: 'updates',
  about: 'ueber',
  developer: 'entwickler',
  startdata: 'module',
  modules: 'module',
};

/** Target of an old `/settings#<hash>` link, or undefined. */
export function legacyTarget(hash: string): string | undefined {
  const id = hash.replace(/^#/, '');
  const category = LEGACY_HASHES[id];
  if (!category) return undefined;
  // The old start-data block now lives inside the module overview.
  return settingsPath(category, id === 'startdata' ? 'modules' : id);
}
