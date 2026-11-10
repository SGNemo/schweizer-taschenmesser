// The areas and their shipped modules, from the generated catalogue (npm run gen:modules in web/). Preview modules
// ("In Arbeit") are left out: the site says nothing about what is not finished (docs/design/site/RETHINK.md).
import catalog from './modules.json';
import type { Locale } from '../i18n';

export interface ModuleRow { id: string; name: string; short: string; hue: string; on: boolean; platforms: 'windows' | 'android' | 'both' | null }
export interface AreaRow { id: string; name: string; modules: ModuleRow[] }

export function areas(locale: Locale): AreaRow[] {
  return catalog.areas
    .map((a) => ({
      id: a.id,
      name: a.name[locale],
      modules: catalog.modules
        .filter((m) => m.area === a.id && m.status !== 'preview')
        .map((m) => ({
          id: m.id,
          name: m.name[locale],
          short: m.short[locale],
          hue: m.hue,
          // On from the start: default modules, and the ones a new installation switches on (`fresh`).
          on: m.status === 'default' || m.fresh,
          platforms: m.platforms as ModuleRow['platforms'],
        })),
    }))
    .filter((a) => a.modules.length > 0);
}
export const moduleCount = (rows: AreaRow[]) => rows.reduce((n, a) => n + a.modules.length, 0);
