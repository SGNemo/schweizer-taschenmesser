import { expect, type Locator, type Page } from '@playwright/test';
import { showPreview } from '../helpers';
import { bootDev, test } from './helpers';

/**
 * The dunning chain on the invented demo mails of the seed (planner hub S1,
 * docs/design/planner-hub/CONCEPT-LINKS.md §2, steps 1, 2, 4, 5): one thing in three places. An invoice filed
 * from a mail knows its mail, a reminder noted on it knows the reminder's mail, and both threads lead back to
 * the invoice itself. Taps are counted: noting a reminder is one tap, from the invoice to its mail is one tap.
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

test.describe('dunning chain (demo mails)', () => {
  test.setTimeout(90_000);
  test.use({
    seeded: { scale: 'medium', desktop: true, preview: true },
    // Wide enough for the master–detail page: the invoice shows in its panel.
    viewport: { width: 1440, height: 900 },
  });

  test('invoice ↔ mail both ways; noting a reminder is one tap, from the invoice to the mail is one tap', async ({
    page,
  }) => {
    await bootDev(page);
    await showPreview(page);
    await asDesktop(page);
    await enable(page, ['mail']);
    let taps = 0;
    const tap = async (target: Locator) => {
      taps += 1;
      await target.click();
    };

    // Step 1 – the invoice mail, „Anlegen“: the invoice and its link to the mail, one tap.
    await page.goto('/mail');
    const create = page.getByRole('button', {
      name: /^Rechnung anlegen: Stadtwerke Musterstadt · 84,30/,
    });
    await expect(create).toBeVisible({ timeout: 10_000 });
    taps = 0;
    await tap(create);
    await expect(page.getByText('Rechnung angelegt')).toBeVisible();
    expect(taps, 'filing the invoice').toBe(1);
    const filed = (await stored(page, 'invoices_invoice')).find(
      (i) => i.payee === 'Stadtwerke Musterstadt' && i.amountMinor === 8430,
    )!;
    expect(filed, 'the invoice of the row').toBeTruthy();
    // P56: no web address of the mail in the note any more.
    expect(filed.note).toBeUndefined();
    const origin = (await stored(page, '_links')).filter(
      (l) => l.fromKey === `invoices:${filed.id}`,
    );
    expect(origin).toHaveLength(1);
    expect(origin[0]).toMatchObject({ rel: 'origin', label: 'Ihre Rechnung für Oktober' });
    expect(String(origin[0]!.toKey)).toMatch(/^mail:[A-Za-z0-9_-]+$/);
    expect(String(origin[0]!.on)).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Step 2 – the reminder mail, „Mahnung vermerken“: one tap, on the open invoice the row names.
    const line = page.getByTestId('mail-invoice-line').filter({ hasText: 'Mahnung zu Rechnung' });
    await expect(line).toContainText('92,40 € bis');
    taps = 0;
    await tap(line.getByRole('button', { name: /^Mahnung vermerken:/ }));
    await expect(page.getByText(/^Mahnung vermerkt/)).toBeVisible();
    expect(taps, 'noting a reminder').toBe(1);
    await expect(line).toContainText('vermerkt');
    const dunning = (await stored(page, '_links')).filter((l) => l.rel === 'dunning');
    expect(dunning).toHaveLength(1);
    const dunned = (await stored(page, 'invoices_invoice')).find(
      (i) => `invoices:${String(i.id)}` === dunning[0]!.fromKey,
    )!;
    // The reminder's claims are fields; the invoice's own amount and due date stay (the seed's open invoice).
    expect(dunned).toMatchObject({ payee: 'Stadtwerke Musterstadt', dunnedAmountMinor: 9240 });
    expect(dunned.amountMinor).not.toBe(9240);
    expect(Number(dunned.dunningLevel)).toBeGreaterThanOrEqual(1);
    expect(String(dunned.dunnedDueDate)).toMatch(/^\d{4}-11-20$/);
    expect(dunning[0]).toMatchObject({ label: 'Zahlungserinnerung Kundennummer 4711' });

    // Privacy (§1.4): a link row holds the thread id, the subject and the mail's day – nothing else of the mail.
    for (const row of await stored(page, '_links')) {
      const text = JSON.stringify(row);
      expect(text).not.toContain('@');
      expect(text).not.toContain('example.org');
      expect(text).not.toMatch(/"demo"|demo\|/); // the account key of the demo mailbox
      expect(text).not.toContain('Mahngebühr');
      expect(String(row.id)).toMatch(/^[0-9a-f]{64}$/);
    }

    // Step 4 – the invoice page says where the invoice came from; one tap leads to the mail.
    await page.goto(`/invoices?open=${dunned.id}`);
    // `?open=` opens the invoice's dialog; the panel behind it shows the same invoice.
    await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click();
    const detail = page.getByTestId('invoice-detail');
    await expect(detail).toContainText('Stadtwerke Musterstadt');
    await expect(detail).toContainText(/Mahnung aus Mail vom \d+\. \p{L}+/u);
    // „Im Plan“: the day the planner gave it, leading to that day (the planner is on in the seed).
    await expect(detail.getByTestId('invoice-planned')).toHaveAttribute(
      'href',
      /^\/planner\?day=\d{4}-\d{2}-\d{2}$/,
    );
    const toReminder = detail.getByRole('link', {
      name: 'Mail „Zahlungserinnerung Kundennummer 4711“ öffnen',
    });
    taps = 0;
    await tap(toReminder);
    await expect(page).toHaveURL(/\/mail/);
    await expect(
      page.getByRole('heading', { name: 'Zahlungserinnerung Kundennummer 4711' }).first(),
    ).toBeVisible();
    expect(taps, 'from the invoice to the mail').toBe(1);

    // Step 5 – the thread lists what came out of it and opens the invoice itself, not the module page.
    const back = page.getByTestId('mail-linked');
    await expect(back).toBeVisible();
    const toInvoice = back.getByRole('link', { name: /Rechnung „Stadtwerke Musterstadt“ öffnen/ });
    await expect(toInvoice).toHaveAttribute('href', `/invoices?open=${dunned.id}`);
    taps = 0;
    await tap(toInvoice);
    await expect(page.getByRole('dialog', { name: 'Rechnung bearbeiten' })).toBeVisible();
    expect(taps, 'from the mail to the invoice').toBe(1);
    await expect(page).not.toHaveURL(/open=/);

    // The invoice filed in step 1 says „Aus Mail“ and leads to its own thread the same way.
    await page.goto(`/invoices?open=${filed.id}`);
    await page.getByRole('dialog').getByRole('button', { name: 'Abbrechen' }).click();
    await expect(detail).toContainText('Aus Mail');
    await tap(detail.getByRole('link', { name: 'Mail „Ihre Rechnung für Oktober“ öffnen' }));
    await expect(
      page.getByRole('heading', { name: 'Ihre Rechnung für Oktober' }).first(),
    ).toBeVisible();
    await expect(page.getByTestId('mail-linked')).toContainText('Stadtwerke Musterstadt');
  });

  test('„Bezahlt …“ route: `?do=pay` opens the pay step and pays nothing until „Bezahlt“', async ({
    page,
  }) => {
    await bootDev(page);
    await enable(page, []);
    const open = (await stored(page, 'invoices_invoice')).find((i) => i.status === 'open')!;
    const before = JSON.stringify(await stored(page, 'invoices_invoice'));
    const bookings = (await stored(page, 'finance_transaction')).length;
    await page.goto(`/invoices?open=${open.id}&do=pay`);
    const step = page.getByRole('dialog', { name: `${String(open.payee)} bezahlt?` });
    await expect(step).toBeVisible();
    await expect(page).not.toHaveURL(/open=|do=/);
    expect(JSON.stringify(await stored(page, 'invoices_invoice'))).toBe(before);
    expect((await stored(page, 'finance_transaction')).length).toBe(bookings);
    // An unknown id opens nothing.
    await page.goto('/invoices?open=no-such-invoice&do=pay');
    await expect(page).not.toHaveURL(/open=|do=/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(JSON.stringify(await stored(page, 'invoices_invoice'))).toBe(before);
    // Settling a late invoice: the plan row's „Bezahlt …“ (this route) and „Bezahlt“ = 2 taps.
    await page.goto(`/invoices?open=${open.id}&do=pay`);
    await page.getByTestId('pay-step-confirm').click();
    await expect(page.getByText('Als bezahlt markiert.')).toBeVisible();
    const paid = (await stored(page, 'invoices_invoice')).find((i) => i.id === open.id)!;
    expect(paid.status).toBe('paid');
  });
});
