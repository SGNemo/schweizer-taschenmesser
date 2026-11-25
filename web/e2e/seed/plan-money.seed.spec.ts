import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { dismissNotices } from '../helpers';
import { test } from './helpers';
import { DESKTOP, PHONE } from './guards';

/**
 * Paying and cancelling in the row (planner hub 2, package 4b, hand-off 04): on today's sheet an open invoice and two
 * cancellation deadlines. The invoice is paid in its compartment (the pay step as one line, the sum prefilled), one
 * deadline is cancelled („Gekündigt am …“ → „Vermerken“) and one kept („Läuft weiter“) – without leaving `/planner`;
 * the rows in IndexedDB say what each module wrote. Plus the open invoice compartment in an axe pass. Invented rows.
 */
const TODAY = '2026-11-30'; // Monday
const base = { createdAt: 1, updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };

const laid = (itemKey: string, order: number) => ({
  id: `${itemKey}#0`,
  itemKey,
  k: 0,
  of: 1,
  date: TODAY,
  minutes: 20,
  order,
  reason: 'new',
});

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
    _modules: ['planner', 'invoices', 'subscriptions', 'finance'].map((id) => ({
      id,
      enabled: true,
      dataPolicy: null,
    })),
    invoices_invoice: [
      {
        id: 'i1',
        payee: 'Stadtwerke Beispiel',
        amountMinor: 8000,
        dueDate: '2026-12-03',
        status: 'open',
      },
    ],
    // Monthly, seven days' notice: the last days to cancel are Thu 3.12. and Tue 8.12.
    subscriptions_subscription: [
      { id: 's1', name: 'Streamingdienst Beispiel', amountMinor: 1299, startDate: '2026-01-10' },
      { id: 's2', name: 'Fitnessstudio Muster', amountMinor: 2990, startDate: '2026-01-15' },
    ].map((s) => ({
      ...s,
      recurrence: { freq: 'monthly', interval: 1 },
      cancelNoticeDays: 7,
      active: true,
    })),
    planner_assignment: [
      laid('invoices:i1', 0),
      laid('subscriptions:s1:2026-12-03', 1),
      laid('subscriptions:s2:2026-12-08', 2),
    ],
  });
  await page.goto('/planner');
  await expect(page.locator('main h1')).toBeVisible();
}

const rowOf = (page: Page, key: string) => page.locator(`[data-row-key="${key}"]`).first();
const open = async (page: Page, key: string) => {
  const row = rowOf(page, key);
  await row.locator('button[data-row]').first().click();
  const box = row.getByTestId('row-compartment');
  await expect(box).toBeVisible();
  return box;
};

for (const [name, viewport, mobile] of [
  ['desktop', DESKTOP, false],
  ['phone', PHONE, true],
] as const) {
  test.describe(`plan panels for money (4b), ${name}`, () => {
    test.use({ viewport, isMobile: mobile, hasTouch: mobile });
    test.setTimeout(120_000);

    test('an invoice paid, one deadline cancelled, one kept – in the planner, which is never left', async ({
      page,
    }) => {
      await prepare(page);
      const pay = await open(page, 'invoices:i1');
      await expect(pay.getByLabel(/Gezahlte Summe/)).toHaveValue('80,00');
      await pay.getByRole('button', { name: 'Bezahlt', exact: true }).click();
      await expect
        .poll(
          async () =>
            (await rows<{ id: string; status: string }>(page, 'invoices_invoice'))[0]?.status,
        )
        .toBe('paid');

      const goes = await open(page, 'subscriptions:s1:2026-12-03');
      await expect(goes).toContainText('Kündigen bis Do 3. Dez');
      await goes.getByRole('button', { name: 'Gekündigt am …' }).click();
      await goes.getByRole('button', { name: 'Vermerken' }).click();
      const stays = await open(page, 'subscriptions:s2:2026-12-08');
      await stays.getByRole('button', { name: 'Läuft weiter' }).click();
      await expect
        .poll(async () =>
          (
            await rows<{ id: string; cancelledOn?: string; keptDeadline?: string }>(
              page,
              'subscriptions_subscription',
            )
          )
            .map((s) => [s.id, s.cancelledOn ?? null, s.keptDeadline ?? null])
            .sort(),
        )
        .toEqual([
          ['s1', TODAY, null],
          ['s2', null, '2026-12-08'],
        ]);
      await expect(page).toHaveURL(/\/planner/);
    });
  });
}

// The open invoice compartment (day field and sum) in the planner's axe pass, light and dark.
for (const scheme of ['light', 'dark'] as const)
  test(`plan panels for money (4b): an open invoice compartment passes axe (${scheme})`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await prepare(page);
    const box = await open(page, 'invoices:i1');
    await expect(box.getByLabel(/Gezahlte Summe/)).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
  });
