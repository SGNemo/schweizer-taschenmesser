import { expect, type Page } from '@playwright/test';
import { showPreview } from '../helpers';
import { bootDev, test } from './helpers';

/**
 * Planner rethink package 2 on the seeded app, after the dunning chain's mail steps (`dunning-chain.seed.spec.ts`
 * steps 1–2): the reminded invoice is a thing with a deadline and no day. It waits under „Noch ohne Tag“ with the
 * chip „Vorschlag: … · Frist …“; one tap on „Übernehmen“ lays it on that day and the invoice says „Im Plan“.
 * Poses as the desktop app (mail is desktop only); nothing leaves the machine.
 */
const asDesktop = (page: Page) =>
  page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'desktop'));

/** Switches the modules on the way the mail seed spec does (a stored module state, then a reload). */
async function enable(page: Page, ids: string[]) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    (modules) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('_modules', 'readwrite');
          for (const id of modules)
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
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    ids,
  );
}

/** Every live row of a table, read straight from IndexedDB (what is stored, not what is shown). */
const stored = (page: Page, table: string) =>
  page.evaluate(
    (name) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction(name).objectStore(name).getAll();
          request.onsuccess = () =>
            resolve(
              (request.result as Record<string, unknown>[]).filter((r) => r.deletedAt === null),
            );
          request.onerror = () => reject(request.error);
        };
      }),
    table,
  );

test.describe('planner: proposal chip on the reminded invoice', () => {
  test.setTimeout(90_000);
  test.use({
    seeded: { scale: 'medium', desktop: true, preview: true },
    viewport: { width: 1440, height: 900 },
  });

  test('the reminded invoice gets „Vorschlag: … · Frist …“; one tap lays it, the invoice says „Im Plan“', async ({
    page,
  }) => {
    await bootDev(page);
    await showPreview(page);
    await asDesktop(page);
    await enable(page, ['mail']);
    // The dunning chain's steps 1 and 2: file the invoice mail, note the reminder on the open invoice.
    await page.goto('/mail');
    const create = page.getByRole('button', {
      name: /^Rechnung anlegen: Stadtwerke Musterstadt · 84,30/,
    });
    await expect(create).toBeVisible({ timeout: 10_000 });
    await create.click();
    await expect(page.getByText('Rechnung angelegt')).toBeVisible();
    const line = page.getByTestId('mail-invoice-line').filter({ hasText: 'Mahnung zu Rechnung' });
    await line.getByRole('button', { name: /^Mahnung vermerken:/ }).click();
    await expect(page.getByText(/^Mahnung vermerkt/)).toBeVisible();
    const dunning = (await stored(page, '_links')).filter((l) => l.rel === 'dunning');
    const dunned = (await stored(page, 'invoices_invoice')).find(
      (i) => `invoices:${String(i.id)}` === dunning[0]!.fromKey,
    )!;
    const detail = page.getByTestId('invoice-detail');
    await page.goto(`/invoices?open=${String(dunned.id)}`);
    await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click();
    // Nothing laid it by itself (package 1).
    await expect(detail.getByTestId('invoice-planned')).toHaveCount(0);

    await page.goto('/planner');
    const waiting = page.locator('[data-group="wait"] h2').getByRole('button');
    if ((await waiting.getAttribute('aria-expanded')) !== 'true') await waiting.click();
    const chip = page
      .locator('li', { hasText: 'Stadtwerke Musterstadt' })
      .getByTestId('proposal-chip');
    await expect(chip).toContainText(/^Vorschlag: \p{L}{2} · Frist \p{L}{2}/u);
    await chip
      .getByRole('button', { name: /^Übernehmen: Stadtwerke Musterstadt bezahlen auf / })
      .click();
    // The toast comes with the stored row: only then is it safe to leave the page.
    await expect(page.getByRole('status').filter({ hasText: /^Liegt auf / })).toBeVisible();
    await expect
      .poll(async () =>
        (await stored(page, 'planner_assignment')).some(
          (r) => r.itemKey === `invoices:${String(dunned.id)}`,
        ),
      )
      .toBe(true);
    await page.goto(`/invoices?open=${String(dunned.id)}`);
    await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click();
    await expect(detail.getByTestId('invoice-planned')).toBeVisible();
  });
});
