import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { dismissNotices } from '../helpers';
import { test } from './helpers';
import { DESKTOP, PHONE } from './guards';

/**
 * Measured duration (planner hub 2, package 8; hand-off 08): two measured records of „Wäsche anstellen“ (8 and 12
 * minutes). Typed anew in the field, the new thing starts with their median – the row says Z1 „10 Min · wie zuletzt“
 * (the phone „10 Min“, the whole text for a screen reader); „Dauer …“ shows Z2; the settings page has the switch and
 * „Gemessene Zeiten löschen“ (Z3). Axe on the row, the dialog and the settings, light and dark. Invented rows only.
 */
const TODAY = '2026-11-30'; // Monday
const base = { updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };
const KEY = 't:wäsche anstellen';
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
            for (const r of rows) tx.objectStore(store).put({ createdAt: 1, ...base, ...r });
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

async function prepare(page: Page) {
  await page.clock.setFixedTime(new Date(`${TODAY}T09:00:00`));
  await dismissNotices(page);
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await put(page, {
    _modules: ['todos', 'planner'].map((id) => ({ id, enabled: true, dataPolicy: null })),
    todos_list: [{ id: 'inbox', name: 'Eingang', order: 0 }],
    planner_measure: [
      { id: 'm1', key: KEY, minutes: 8, on: '2026-11-23', createdAt: 1 },
      { id: 'm2', key: KEY, minutes: 12, on: '2026-11-27', createdAt: 2 },
    ],
  });
  await page.goto('/planner');
  await expect(page.locator('main h1')).toBeVisible();
}

/** Types the thing anew; returns its row. */
async function addWash(page: Page) {
  const field = page.getByRole('textbox', { name: 'Eintragen oder sagen' });
  await field.fill('Wäsche anstellen');
  await field.press('Enter');
  const row = page
    .getByTestId(`day-${TODAY}`)
    .locator('li')
    .filter({
      has: page.getByRole('checkbox', { name: 'Erledigt: Wäsche anstellen', exact: true }),
    })
    .first();
  await expect(row).toBeVisible();
  return row;
}

for (const [name, viewport, mobile] of [
  ['desktop', DESKTOP, false],
  ['phone', PHONE, true],
] as const) {
  test.describe(`measured duration (8), ${name}`, () => {
    test.use({ viewport, isMobile: mobile, hasTouch: mobile });
    test.setTimeout(120_000);
    test('a new thing starts with what it took the last times; „Dauer …“ says so; setting it by hand ends Z1', async ({
      page,
    }) => {
      await prepare(page);
      const row = await addWash(page);
      // Z1: the minutes, „· wie zuletzt“ on the desktop; the phone shows the minutes alone, the whole text for a reader.
      await expect(row.getByText('10 Min · wie zuletzt', { exact: true }).first()).toBeAttached();
      if (mobile)
        await expect(row.getByText('wie zuletzt', { exact: false }).first()).toBeAttached();
      await row.getByRole('button', { name: 'Aktionen für Wäsche anstellen', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Dauer …' }).click();
      const dialog = page.getByRole('dialog', { name: 'Dauer: Wäsche anstellen' });
      await expect(dialog.getByText('zuletzt 12, 8 Min', { exact: true })).toBeVisible();
      // The length the row shows is a chip of its own, chosen (10 is none of 5 / 15 / 30 / 60).
      await expect(dialog.getByRole('button', { name: '10 Min', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await dialog.getByRole('button', { name: '15 Min', exact: true }).click();
      await expect(row.getByText('wie zuletzt')).toHaveCount(0);
    });
  });
}

for (const scheme of ['light', 'dark'] as const)
  test(`measured duration (8): row, „Dauer …“ and the settings pass axe (${scheme})`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await prepare(page);
    const row = await addWash(page);
    const axe = async () =>
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`);
    expect(await axe()).toEqual([]);
    await row.getByRole('button', { name: 'Aktionen für Wäsche anstellen', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Dauer …' }).click();
    await expect(page.getByText('zuletzt 12, 8 Min', { exact: true })).toBeVisible();
    expect(await axe()).toEqual([]);
    await page.keyboard.press('Escape');
    await page.goto('/settings/module/planner');
    await expect(page.getByText('Aus gemessener Zeit vorschlagen').first()).toBeVisible();
    await expect(page.getByText('Gemessene Zeiten löschen').first()).toBeVisible();
    expect(await axe()).toEqual([]);
    // Z3's confirm: what goes and what stays, then nothing happens on „Abbrechen“.
    await page.locator('#planner-measure-delete').getByRole('button', { name: 'Löschen' }).click();
    const confirm = page.getByRole('dialog', { name: 'Gemessene Zeiten löschen' });
    await expect(confirm.getByText(/Minuten, die schon im Plan stehen, bleiben/)).toBeVisible();
    expect(await axe()).toEqual([]);
    await confirm.getByRole('button', { name: 'Abbrechen' }).click();
  });
