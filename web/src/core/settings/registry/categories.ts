import { t } from '@/strings';
import { SETTINGS_CATEGORY_IDS, type SettingsCategoryDef, type SettingsCategoryId } from './types';

/** Icon (from `ui/icons`) per category. */
const ICONS: Record<SettingsCategoryId, string> = {
  allgemein: 'settings',
  darstellung: 'sun',
  module: 'grid',
  werkzeuge: 'wrench',
  benachrichtigungen: 'bell',
  sicherheit: 'lock',
  sync: 'sync',
  ki: 'sparkles',
  verbindungen: 'globe',
  schnellerfassung: 'plus',
  updates: 'download',
  entwickler: 'braces',
  ueber: 'help',
};

export const SETTINGS_CATEGORIES: readonly SettingsCategoryDef[] = SETTINGS_CATEGORY_IDS.map(
  (id) => ({ id, icon: ICONS[id], ...t.settings.cat[id] }),
);

export function categoryDef(id: SettingsCategoryId): SettingsCategoryDef {
  return SETTINGS_CATEGORIES.find((c) => c.id === id)!;
}
