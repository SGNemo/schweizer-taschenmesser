/**
 * What the stimulus inventory measures (`stimulus.spec.ts`): every module route that needs no id, the library
 * and the overview in both views, plus a few sub-pages, at two window sizes. A unit test
 * (`scripts/lib/stimulusBudget.test.ts`) fails when a manifest route is missing here. The page name is the
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
  /** Desktop-only module (`manifest.platforms`): not measured on the phone. */
  desktop?: boolean;
  /** `localStorage['tm-home-view']` for the overview. */
  homeView?: 'calm' | 'all';
}

const mod = (id: string, desktop = false): StimulusPage => ({
  name: id,
  path: `/${id}`,
  module: id,
  ...(desktop ? { desktop } : {}),
});

/** One entry per parameter-free route of every module manifest (the dev-only `example` module is left out). */
export const MODULE_PAGES: StimulusPage[] = [
  mod('accounts'),
  mod('bookmarks'),
  mod('browser', true),
  mod('budgets'),
  mod('calendar'),
  mod('chat'),
  mod('clock'),
  mod('disk', true),
  { name: 'disk-scan', path: '/disk/scan', module: 'disk', desktop: true },
  mod('downloads', true),
  mod('feeds'),
  mod('finance'),
  mod('fitness'),
  mod('habits'),
  mod('invoices'),
  mod('lists'),
  mod('mail', true),
  mod('maps'),
  mod('music'),
  mod('notes'),
  mod('pantry'),
  mod('people'),
  mod('planner'),
  mod('subscriptions'),
  mod('timetrack'),
  mod('todos'),
  mod('vault'),
  mod('weather'),
];

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
