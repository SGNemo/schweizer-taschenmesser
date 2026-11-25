import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { dismissNotices } from '../helpers';
import { test } from './helpers';
import { DESKTOP, PHONE } from './guards';

/**
 * Collective rows (planner hub 2, package 2, hand-off 02): three open invoices and a cancellation deadline wait without a
 * day. The planner offers „4 Dinge aus Finanzen · Als eine Zeile zeigen“; one tap folds them into „Finanzen checken“;
 * expanded, one invoice is paid with its line's „Bezahlt“ and the count falls – without leaving `/planner`. Invented rows.
 */
const TODAY = '2026-11-30'; // Monday
const base = { createdAt: 1, updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };

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
      { id: 'i1', payee: 'Stadtwerke Beispiel', amountMinor: 8000, dueDate: '2026-12-04' },
      { id: 'i2', payee: 'Zahnarzt Muster', amountMinor: 12000, dueDate: '2026-12-10' },
      { id: 'i3', payee: 'Versicherung Beispiel', amountMinor: 4590, dueDate: '2026-12-08' },
    ].map((i) => ({ ...i, status: 'open' })),
    subscriptions_subscription: [
      {
        id: 's1',
        name: 'Streamingdienst Beispiel',
        amountMinor: 1299,
        startDate: '2026-01-10',
        recurrence: { freq: 'monthly', interval: 1 },
        cancelNoticeDays: 7,
        active: true,
      },
    ],
  });
  await page.goto('/planner');
  await expect(page.locator('main h1')).toBeVisible();
}

const rowOf = (page: Page, key: string) => page.locator(`[data-row-key="${key}"]`).first();

async function unfoldWaiting(page: Page) {
  const head = page.getByRole('button', { name: /Noch ohne Tag/ }).first();
  if ((await head.getAttribute('aria-expanded')) === 'false') await head.click();
}

for (const [name, viewport, mobile] of [
  ['desktop', DESKTOP, false],
  ['phone', PHONE, true],
] as const) {
  test.describe(`plan piles (2), ${name}`, () => {
    test.use({ viewport, isMobile: mobile, hasTouch: mobile });
    test.setTimeout(120_000);

    test('offer → one row → expand → pay one → the count falls', async ({ page }) => {
      await prepare(page);
      await unfoldWaiting(page);
      const offer = page.getByTestId('pile-offer');
      await expect(offer).toContainText('4 Dinge aus Finanzen');
      await offer.getByRole('button', { name: 'Als eine Zeile zeigen' }).click();
      await expect(page.getByText('Finanzen ist jetzt eine Zeile.')).toBeVisible();
      const pile = rowOf(page, 'planner:pile-money');
      await expect(pile).toBeVisible();
      // The single rows are folded into it.
      await expect(rowOf(page, 'invoices:i1')).toHaveCount(0);
      await expect(pile).toContainText(mobile ? '4 Dinge' : '3 Rechnungen');
      await pile.getByRole('button', { name: /^Finanzen checken.*Aufklappen$/ }).click();
      const box = pile.getByTestId('row-compartment');
      await expect(box).toContainText('Rechnungen offen');
      await expect(box).toContainText('Kündigungsfristen');
      await box.getByRole('button', { name: 'Bezahlt' }).first().click();
      await expect
        .poll(
          async () =>
            (await rows<{ id: string; status: string }>(page, 'invoices_invoice'))
              .filter((i) => i.status === 'paid')
              .map((i) => i.id).length,
        )
        .toBe(1);
      await expect(pile).toContainText(mobile ? '3 Dinge' : '2 Rechnungen');
      await expect(page).toHaveURL(/\/planner/);
    });
  });
}

// The open pile in the planner's axe pass (light and dark).
for (const scheme of ['light', 'dark'] as const)
  test(`plan piles (2): an open pile passes axe (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: scheme });
    await prepare(page);
    await unfoldWaiting(page);
    await expect(page.getByTestId('pile-offer')).toBeVisible();
    const results0 = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results0.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    await page.getByRole('button', { name: 'Als eine Zeile zeigen' }).click();
    const pile = rowOf(page, 'planner:pile-money');
    await pile.getByRole('button', { name: /^Finanzen checken.*Aufklappen$/ }).click();
    await expect(pile.getByTestId('row-compartment')).toContainText('Rechnungen offen');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
  });
