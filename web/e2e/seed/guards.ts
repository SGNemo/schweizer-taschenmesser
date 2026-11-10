import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { bootDev, SEED_TODAY } from './helpers';

/**
 * Shared set-up of the guard specs of UI audit 2026-11, package 0a-1b (`*.seed.spec.ts` in this folder): the seeded
 * Dev-Preview build with every module on, the way the stimulus measurement sets the app up. The seed project runs with
 * the desktop device only, so a guard for the phone sets its viewport itself (`PHONE`).
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const MODULES = join(HERE, '../../src/modules');

export const DESKTOP = { width: 1920, height: 1080 } as const;
export const PHONE = { width: 412, height: 915 } as const;

/** Every module with a manifest (not the dev-only example). */
const manifestOf = (id: string) => readFileSync(join(MODULES, id, 'manifest.ts'), 'utf8');

/**
 * True when the module exists in the faked desktop app of these runs: no platform limit, or one that names the
 * desktop. A phone-only module (`platforms: ['android']`) has no page here; its own spec fakes the phone.
 */
export const onDesktop = (id: string): boolean => {
  const limit = /\bplatforms: \[([^\]]*)\]/.exec(manifestOf(id));
  return !limit || limit[1]!.includes("'desktop'");
};

/** Every module with a manifest that the desktop window shows (not the dev-only example). */
export const MODULE_IDS = readdirSync(MODULES)
  .filter((id) => id !== 'example' && existsSync(join(MODULES, id, 'manifest.ts')))
  .filter(onDesktop)
  .sort();

/**
 * The modules of the phone-sized window: a browser at 412 px is the web platform, so everything with a platform limit
 * (`manifest.platforms`: desktop app, Android app) is not there.
 */
export const PHONE_MODULE_IDS = MODULE_IDS.filter((id) => !/\bplatforms: \[/.test(manifestOf(id)));

/** Entry route of every module for the given window. */
export const moduleRoutes = (phone: boolean): string[] =>
  (phone ? PHONE_MODULE_IDS : MODULE_IDS).map((id) => `/${id}`);

async function enableModules(page: Page, ids: readonly string[]) {
  await page.evaluate(
    (list) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          for (const id of list)
            tx.objectStore('_modules').put({
              id,
              enabled: true,
              dataPolicy: null,
              createdAt: 1,
              updatedAt: 1,
              deviceId: 'e2e',
              deletedAt: null,
              _f: {},
            });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    ids,
  );
}

/**
 * Opens the seeded app (the test uses `seeded: { … }` of `./helpers`) with every module of the window on. `phone`
 * leaves the desktop-only modules out, as a phone does.
 */
export async function startSeeded(page: Page, opts: { phone?: boolean } = {}) {
  await page.addInitScript((desktop) => {
    localStorage.setItem('tm-show-preview', '1');
    if (desktop) localStorage.setItem('__tmPlatformKind', 'desktop');
  }, !opts.phone);
  await bootDev(page);
  await page.goto('/settings/entwickler');
  await expect(page.getByTestId('seed-status')).toContainText(SEED_TODAY);
  await enableModules(page, opts.phone ? PHONE_MODULE_IDS : MODULE_IDS);
}

/** Opens a page and waits for its own heading and a settled first paint. */
export async function openPage(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('main h1').first(), path).toBeVisible();
  await page.waitForTimeout(250);
}
