import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * What the stimulus inventory measures (`stimulus.spec.ts`): every module route that needs no id, the library
 * and the overview in both views, plus a few sub-pages, at two window sizes. The page name is the
 * second half of the budget key (`<viewport>--<name>` in `e2e/stimulus-budget.json`); for a module route it is
 * the route without slashes (`/disk/scan` → `disk-scan`), which is how the ratchet recognises a new route.
 */
export interface StimulusViewport {
  name: string;
  width: number;
  height: number;
  mobile: boolean;
}
export const VIEWPORTS: StimulusViewport[] = [
  { name: 'd1920', width: 1920, height: 1080, mobile: false },
  { name: 'p412', width: 412, height: 915, mobile: true },
];

export interface StimulusPage {
  name: string;
  path: string;
  /** Module to switch on for this page. */
  module?: string;
  /** Platform-bound module (`manifest.platforms`): not measured on the phone window. */
  desktop?: boolean;
  /** `localStorage['tm-home-view']` for the overview. */
  homeView?: 'calm' | 'all';
}

/**
 * One entry per parameter-free route of every module manifest, read from the manifests themselves (text only,
 * nothing is imported): a new module is measured without touching this protected file. The dev-only `example`
 * module is left out.
 */
function modulePages(): StimulusPage[] {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/modules');
  const pages: StimulusPage[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'example') continue;
    const manifest = join(dir, entry.name, 'manifest.ts');
    if (!existsSync(manifest)) continue;
    const text = readFileSync(manifest, 'utf8');
    // A module with `platforms` does not exist in the plain web build: it is measured on the desktop window
    // only, where the spec fakes the desktop platform.
    const desktop = /\bplatforms:\s*\[/.test(text);
    for (const m of text.matchAll(/\bpath:\s*'([^']+)'/g)) {
      const path = m[1]!;
      if (path.includes(':')) continue;
      pages.push({
        name: path.replace(/^\/+/, '').replace(/\//g, '-'),
        path,
        module: entry.name,
        ...(desktop ? { desktop } : {}),
      });
    }
  }
  return pages.sort((x, y) => x.name.localeCompare(y.name));
}
export const MODULE_PAGES: StimulusPage[] = modulePages();

export const SHELL_PAGES: StimulusPage[] = [
  { name: 'home-calm', path: '/', homeView: 'calm' },
  { name: 'home-all', path: '/', homeView: 'all' },
  { name: 'library', path: '/library' },
  { name: 'reminders', path: '/calendar?tab=reminders' },
  { name: 'bookmarks-links', path: '/bookmarks?view=links' },
  { name: 'settings', path: '/settings' },
  { name: 'settings-darstellung', path: '/settings/darstellung' },
  { name: 'settings-benachrichtigungen', path: '/settings/benachrichtigungen' },
  { name: 'settings-module', path: '/settings/module' },
];

export const PAGES: StimulusPage[] = [...SHELL_PAGES, ...MODULE_PAGES];
