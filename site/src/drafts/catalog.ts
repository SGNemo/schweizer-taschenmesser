// The areas and their shipped modules for the drafts, from the generated catalogue (npm run gen:modules in web/).
// Preview modules ("In Arbeit") are left out: the page says nothing about what is not finished.
import catalog from '../catalog/modules.json';
import type { Locale } from '../i18n';

export interface AreaRow {
  id: string;
  name: string;
  modules: { name: string; hue: string; on: boolean; platforms: string | null }[];
}
export function areas(locale: Locale): AreaRow[] {
  return catalog.areas
    .map((a) => ({
      id: a.id,
      name: a.name[locale],
      modules: catalog.modules
        .filter((m) => m.area === a.id && m.status !== 'preview')
        .map((m) => ({ name: m.name[locale], hue: m.hue, on: m.status === 'default', platforms: m.platforms as string | null })),
    }))
    .filter((a) => a.modules.length > 0);
}
export const moduleCount = (rows: AreaRow[]) => rows.reduce((n, a) => n + a.modules.length, 0);
