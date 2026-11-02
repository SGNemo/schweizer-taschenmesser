import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { showAllWidgets } from '../helpers';
import { bootDev, seedApp } from './helpers';

/**
 * Mail module on the invented demo mails of the seed (account `demo`): nothing leaves the machine, no
 * Google login involved. Poses as the desktop app because the module is desktop-only.
 */
const asDesktop = (page: Page) =>
  page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'desktop'));

async function enableMail(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('_modules', 'readwrite');
          tx.objectStore('_modules').put({
            id: 'mail',
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
  );
}

async function audit(page: Page, label: string) {
  // `label-content-name-mismatch` on the GroupedList toggle ("Heute 2" vs "Heute einklappen") is a
  // known finding of the shared component (it shows on /invoices with seed data too), not of mail.
  const results = await new AxeBuilder({ page })
    .disableRules(['label-content-name-mismatch'])
    // the mail body is third-party content in a script-free sandbox; axe cannot enter it (and hangs trying)
    .exclude('iframe[title^="Inhalt der Mail"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.help} ${v.nodes[0]?.target.join(' ')}`),
    label,
  ).toEqual([]);
}

test.describe('mail (demo mails)', () => {
  test.setTimeout(120_000); // each test loads the seed first
  test.beforeEach(async ({ page }) => {
    await bootDev(page);
    await asDesktop(page);
    await seedApp(page, 'medium');
    await enableMail(page);
  });

  test('lists the demo inbox by day and says it is test data', async ({ page }) => {
    await page.goto('/mail');
    await expect(page.getByText('Beispiel-Mails (Testdaten)')).toBeVisible();
    await expect(page.getByText('Ihre Rechnung für Oktober')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Heute/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Gestern/ })).toBeVisible();
  });

  test('opens a mail in a script-free sandbox; trackers are gone, nothing is written', async ({
    page,
  }) => {
    await page.goto('/mail');
    await page.getByText('Ihre Rechnung für Oktober').click();
    const frame = page.getByTitle(/Inhalt der Mail/);
    await expect(frame).toHaveAttribute('sandbox', 'allow-same-origin');
    const inner = page.frameLocator('iframe[title^="Inhalt der Mail"]');
    await expect(inner.getByText('84,30 EUR')).toBeVisible();
    await expect(page.getByText('1 Tracking-Pixel entfernt')).toBeVisible();
    expect(await frame.getAttribute('srcdoc')).not.toMatch(/track\.example|<script/);
    await expect(page.getByText(/Ungelesen-Status ändert sich dadurch nicht/)).toBeVisible();
    // back to the list
    await page.getByRole('button', { name: 'Zur Liste' }).click();
    await expect(page.getByText('Ihre Rechnung für Oktober')).toBeVisible();
  });

  test('widgets show unread count, top mails and invoice mails', async ({ page }) => {
    await showAllWidgets(page);
    await page.goto('/');
    await expect(page.locator('main h1')).toBeVisible();
    const unread = page.getByTestId('widget-mail:unread');
    await expect(unread).toContainText('Ungelesene Threads im Posteingang');
    await expect(page.getByTestId('widget-mail:top')).toContainText('Ihre Rechnung für Oktober');
    await expect(page.getByTestId('widget-mail:invoices')).toContainText('in den letzten 30 Tagen');
  });

  test('mail settings: accounts, permission, cache, notifications', async ({ page }) => {
    await page.goto('/mail');
    await page.getByRole('button', { name: 'Mail-Einstellungen' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Konten' })).toBeVisible();
    await expect(dialog.getByText(/gmail\.readonly/)).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Zwischenspeicher' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Benachrichtigungen' })).toBeVisible();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`accessibility and screenshots (${scheme})`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto('/mail');
      await expect(page.getByText('Ihre Rechnung für Oktober')).toBeVisible();
      await audit(page, `list (${scheme})`);
      const out = process.env.MAIL_SHOTS;
      if (out)
        await page.screenshot({ path: `${out}/mail-list-${info.project.name}-${scheme}.png` });
      await page.getByText('Ihre Rechnung für Oktober').click();
      await expect(page.getByTitle(/Inhalt der Mail/)).toBeVisible();
      await audit(page, `thread (${scheme})`);
      if (out)
        await page.screenshot({ path: `${out}/mail-thread-${info.project.name}-${scheme}.png` });
    });
  }
});
