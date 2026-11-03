import { t } from '@/strings';
import { tSettings4 } from '@/strings.settings4';
import { SETTINGS_CATEGORY_IDS, type SettingsCategoryDef, type SettingsCategoryId } from './types';

/** Icon (from `ui/icons`) per category. */
const ICONS: Record<SettingsCategoryId, string> = {
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

/** The texts of a category; the accessibility category's live in its own bundle (no hotspot edit of `strings.ts`). */
function catText(id: SettingsCategoryId) {
  return id === 'barrierefreiheit' ? tSettings4.get().accessibility.cat : t.settings.cat[id];
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
