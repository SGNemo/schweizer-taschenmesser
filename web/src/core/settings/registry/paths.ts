import type { SettingsCategoryId } from './types';

/** `/settings/<category>#<section>[--<field>]` – the one way to link into the settings. */
export function settingsPath(
  category: SettingsCategoryId,
  sectionId?: string,
  fieldKey?: string,
): string {
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
  return category ? settingsPath(category, id) : undefined;
}
