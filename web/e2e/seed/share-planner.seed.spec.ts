import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { dismissNotices } from '../helpers';
import { test } from './helpers';
import { DESKTOP, PHONE } from './guards';

/**
 * Shared into the planner (planner hub 2, package 1; hand-off 01, PWA path `GET /share?title&text&url`): with the planner
 * on the form starts with the kind `plan`, S2 and S16 under it; „Speichern“ → S8 with „Ansehen“; the row lies under „Noch
 * ohne Tag“ with the chip S7 (a link out, never fetched); „Rückgängig“ on the page takes it away (S14). Axe light and
 * dark on the page before and after „Speichern“. Invented content only.
 */
const TODAY = '2026-11-30'; // Monday
const base = { createdAt: 1, updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };
const SHARED = '/share?title=Fahrradtr%C3%A4ger&url=https%3A%2F%2Fexample.org%2Ffahrradtraeger';
async function put(page: Page, rowsByStore: Record<string, Record<string, unknown>[]>) {
  await page.evaluate(
    ({ rowsByStore, base }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(Object.keys(rowsByStore), 'readwrite');
          for (const [store, rows] of Object.entries(rowsByStore))
            for (const r of rows) tx.objectStore(store).put({ ...base, ...r });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { rowsByStore, base },
  );
}
async function rows<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    (store) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(store).objectStore(store).getAll();
          req.onsuccess = () => {
            db.close();
            resolve(req.result as T[]);
          };
          req.onerror = () => reject(req.error);
        };
      }),
    store,
  );
}

async function prepare(page: Page) {
  await page.clock.setFixedTime(new Date(`${TODAY}T09:00:00`));
  await dismissNotices(page);
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await put(page, {
    _modules: ['todos', 'planner'].map((id) => ({ id, enabled: true, dataPolicy: null })),
    todos_list: [{ id: 'inbox', name: 'Eingang', order: 0 }],
  });
  await page.goto(SHARED);
  await expect(page.getByText('Landet im Planer unter „Noch ohne Tag“.')).toBeVisible();
}
const live = async (page: Page) =>
  (
    await rows<{ deletedAt: number | null; title: string; note?: string }>(page, 'todos_task')
  ).filter((r) => r.deletedAt === null);

for (const [name, viewport, mobile] of [
  ['desktop', DESKTOP, false],
  ['phone', PHONE, true],
] as const) {
  test.describe(`share into the planner (1), ${name}`, () => {
    test.use({ viewport, isMobile: mobile, hasTouch: mobile });
    test.setTimeout(120_000);
    test('„Speichern“ → „Abgelegt.“ → „Ansehen“: the row under „Noch ohne Tag“ with its chip; „Rückgängig“ takes it back', async ({
      page,
    }) => {
      await prepare(page);
      await expect(page.getByText('Der Link wird mit abgelegt: example.org')).toBeVisible();
      // Nothing is written before the button.
      expect(await live(page)).toEqual([]);
      await page.getByRole('button', { name: 'Speichern', exact: true }).click();
      await expect(page.getByTestId('share-saved')).toHaveText('Abgelegt.');
      await expect
        .poll(async () => (await live(page)).map((r) => [r.title, r.note]))
        .toEqual([['Fahrradträger', 'https://example.org/fahrradtraeger']]);
      await page.getByRole('link', { name: 'Ansehen', exact: true }).click();
      await expect(page).toHaveURL(/\/planner/);
      const row = page.locator('main li').filter({ hasText: 'Fahrradträger' }).first();
      await expect(row).toBeVisible();
      const chip = row.getByRole('button', { name: 'Im Browser öffnen · example.org' });
      await expect(chip).toBeVisible();

      // A second share, taken back on the page.
      await page.goto(SHARED);
      await expect(page.getByText('Landet im Planer unter „Noch ohne Tag“.')).toBeVisible();
      await page.getByRole('button', { name: 'Speichern', exact: true }).click();
      await expect(page.getByTestId('share-saved')).toHaveText('Abgelegt.');
      await expect.poll(async () => (await live(page)).length).toBe(2);
      await page
        .getByTestId('share-saved')
        .locator('..')
        .getByRole('button', { name: 'Rückgängig', exact: true })
        .click();
      await expect(page.getByTestId('share-saved')).toHaveText('Zurückgenommen.');
      await expect(page.getByRole('link', { name: 'Ansehen', exact: true })).toHaveCount(0);
      await expect.poll(async () => (await live(page)).length).toBe(1);
    });
  });
}

for (const scheme of ['light', 'dark'] as const)
  test(`share into the planner (1): the page passes axe before and after „Speichern“ (${scheme})`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(PHONE);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await prepare(page);
    const axe = async () =>
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`);
    expect(await axe()).toEqual([]);
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByTestId('share-saved')).toHaveText('Abgelegt.');
    expect(await axe()).toEqual([]);
    void DESKTOP;
  });
