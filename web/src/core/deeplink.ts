/**
 * The internal deep-link schema: one readable address for "this setting / this library card / this
 * tool", used in docs, the palette and widgets.
 *
 *   nemo://settings/<category>[/<section>[/<field>]]  →  /settings/<category>#<section>[--<field>]
 *   nemo://library[/<module>]                         →  /library#module-<module>
 *   nemo://tools[/<tool>]                             →  /tools#tool-<tool>
 *
 * Internal only: the app never registers `nemo://` with the operating system and never opens one
 * that arrives from outside; `parseAppLink` only maps a string to an in-app route (and refuses
 * anything that is not a plain id).
 */
import { settingsPath } from './settings/registry/paths';
import { isCategoryId } from './settings/registry/types';

const SCHEME = 'nemo://';
const ID = /^[a-z0-9][a-z0-9-]*$/i;

/** In-app path for a `nemo://` address, or `undefined` when it is not a valid one. */
export function parseAppLink(link: string): string | undefined {
  if (!link.startsWith(SCHEME)) return undefined;
  const parts = link.slice(SCHEME.length).split('/').filter(Boolean);
  const [area, ...rest] = parts;
  if (!rest.every((p) => ID.test(p))) return undefined;
  switch (area) {
    case 'settings': {
      const [category, section, field, ...extra] = rest;
      if (!isCategoryId(category) || extra.length > 0) return undefined;
      if (field && !section) return undefined;
      return settingsPath(category, section, field);
    }
    case 'library':
      return rest.length > 1 ? undefined : rest[0] ? `/library#module-${rest[0]}` : '/library';
    case 'tools':
      return rest.length > 1 ? undefined : rest[0] ? `/tools#tool-${rest[0]}` : '/tools';
    default:
      return undefined;
  }
}

/** The `nemo://` address of an in-app path built by `settingsPath`, or the library/tools routes. */
export function toAppLink(path: string): string | undefined {
  const [route = '', hash = ''] = path.split('#');
  const settings = /^\/settings\/([^/]+)$/.exec(route);
  if (settings) {
    const [section, field] = hash.split('--');
    return `${SCHEME}settings/${settings[1]}${section ? `/${section}${field ? `/${field}` : ''}` : ''}`;
  }
  if (route === '/library')
    return `${SCHEME}library${hash.startsWith('module-') ? `/${hash.slice(7)}` : ''}`;
  if (route === '/tools')
    return `${SCHEME}tools${hash.startsWith('tool-') ? `/${hash.slice(5)}` : ''}`;
  return undefined;
}
