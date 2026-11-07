import { t } from '@/strings';
import { tSettings4 } from '@/strings.settings4';
import { tSettingsV31 } from '@/strings.settingsV31';
import { SETTINGS_CATEGORY_IDS, type SettingsCategoryDef, type SettingsCategoryId } from './types';

/** Icon (from `ui/icons`) per category. */
const ICONS: Record<SettingsCategoryId, string> = {
  einrichtung: 'checklist',
  allgemein: 'settings',
  darstellung: 'sun',
  barrierefreiheit: 'eye',
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

/** The texts of a category; the accessibility and setup categories' live in their own bundles (no hotspot edit of `strings.ts`). */
function catText(id: SettingsCategoryId) {
  if (id === 'barrierefreiheit') return tSettings4.get().accessibility.cat;
  if (id === 'einrichtung') return tSettingsV31.get().setupCat;
  return t.settings.cat[id];
}

/** Texts are getters: they are read when shown, so they follow a language switch. */
export const SETTINGS_CATEGORIES: readonly SettingsCategoryDef[] = SETTINGS_CATEGORY_IDS.map(
  (id) => ({
    id,
    icon: ICONS[id],
    get title() {
      return catText(id).title;
    },
    get description() {
      return catText(id).description;
    },
    get keywords() {
      return catText(id).keywords;
    },
  }),
);

export function categoryDef(id: SettingsCategoryId): SettingsCategoryDef {
  return SETTINGS_CATEGORIES.find((c) => c.id === id)!;
}
