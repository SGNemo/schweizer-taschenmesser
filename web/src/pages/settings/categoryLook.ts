/**
 * Display-only look of a settings category: the hue and the quiet area pattern its head, plate and
 * nav entry use (identity v3). Not part of the registry on purpose: a category stays an id, a title
 * and an icon there; colour is presentation (docs/design/MODULE-IDENTITY.md "Settings and libraries").
 */
import type { AreaId, ModuleHue } from '@/core/modules/types';
import type { SettingsCategoryId } from '@/core/settings/registry/types';

export interface CategoryLook {
  hue: ModuleHue;
  /** Drives `data-area`: the pattern behind the head (`system` = none). */
  area: AreaId;
}

export const CATEGORY_LOOK: Readonly<Record<SettingsCategoryId, CategoryLook>> = {
  allgemein: { hue: 'slate', area: 'system' },
  darstellung: { hue: 'orchid', area: 'knowledge' },
  barrierefreiheit: { hue: 'teal', area: 'system' },
  module: { hue: 'cobalt', area: 'plan' },
  werkzeuge: { hue: 'moss', area: 'household' },
  benachrichtigungen: { hue: 'indigo', area: 'plan' },
  sicherheit: { hue: 'slate', area: 'vault' },
  sync: { hue: 'ocean', area: 'system' },
  ki: { hue: 'violet', area: 'knowledge' },
  verbindungen: { hue: 'sky', area: 'system' },
  schnellerfassung: { hue: 'lime', area: 'plan' },
  updates: { hue: 'fern', area: 'system' },
  entwickler: { hue: 'slate', area: 'system' },
  ueber: { hue: 'slate', area: 'system' },
};

/** Look of the settings landing page ("Status" head). */
export const STATUS_LOOK: CategoryLook = { hue: 'slate', area: 'system' };

/**
 * Display grouping of the category list (small headings in the nav). The groups are contiguous slices of the
 * registry order (the navigation order never changes); `categoryLook.test.ts` pins that.
 */
export type NavGroupId = 'you' | 'work' | 'data' | 'connect' | 'app';

export const NAV_GROUPS: readonly { id: NavGroupId; categories: readonly SettingsCategoryId[] }[] =
  [
    { id: 'you', categories: ['allgemein', 'darstellung', 'barrierefreiheit'] },
    { id: 'work', categories: ['module', 'werkzeuge', 'benachrichtigungen'] },
    { id: 'data', categories: ['sicherheit', 'sync'] },
    { id: 'connect', categories: ['ki', 'verbindungen', 'schnellerfassung'] },
    { id: 'app', categories: ['updates', 'entwickler', 'ueber'] },
  ];
