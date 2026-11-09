import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { showAllWidgets, showPreview } from '../helpers';
import { bootDev, test } from './helpers';

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

// MAIL_MOBILE=1: the same flows at an Android phone's viewport (screenshots)
if (process.env.MAIL_MOBILE) test.use({ viewport: { width: 412, height: 915 } });

test.describe('mail (demo mails)', () => {
  test.setTimeout(60_000); // axe audits and screenshots on a busy runner
  // The medium seed is loaded once per worker (as the desktop app, preview on); each test gets its own copy.
  test.use({ seeded: { scale: 'medium', desktop: true, preview: true } });
  test.beforeEach(async ({ page }) => {
    await bootDev(page);
    await showPreview(page);
    await asDesktop(page);
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
    // back to the list: the thread heading goes first, then the subject is the list row only (while both are
    // there the text matches two elements and Playwright's strict mode fails at once instead of waiting)
    await page.getByRole('button', { name: 'Zur Liste' }).click();
    await expect(page.getByRole('heading', { name: 'Ihre Rechnung für Oktober' })).toHaveCount(0);
    await expect(page.getByText('Ihre Rechnung für Oktober')).toBeVisible();
  });

  test('creates an invoice from a mail: preview first, link back in the thread', async ({
    page,
  }) => {
    await page.goto('/mail');
    await page.getByText('Ihre Rechnung für Oktober').click();
    await page.getByRole('button', { name: 'Aus dieser Mail anlegen' }).click();
    await page.getByRole('menuitem', { name: 'Rechnung' }).click();
    const dialog = page.getByRole('dialog');
    // prefilled from the mail text; the preview shows what would be saved, nothing is saved yet
    await expect(dialog.getByRole('textbox')).toHaveValue(/Stadtwerke Musterstadt 84,30 €/);
    await expect(dialog.getByTestId('capture-chips')).toContainText('84,30');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toHaveCount(0);
    // the way back from the thread
    await expect(page.getByTestId('mail-linked')).toContainText('Rechnung: Stadtwerke Musterstadt');
    await page.getByTestId('mail-linked').getByRole('link').click();
    await expect(page).toHaveURL(/\/invoices/);
    await expect(page.getByText('Stadtwerke Musterstadt').first()).toBeVisible();
  });

  test('„In den Plan“ from a row: one tap, the row says „im Plan“, the open thread says so too', async ({
    page,
  }) => {
    await page.goto('/mail');
    const row = page.getByRole('button', {
      name: /^(In den Plan|Als ToDo): Anna Beispiel · Wochenende\?/,
    });
    await row.click();
    await expect(page.getByText(/^(Im Plan|Als ToDo gespeichert)/).first()).toBeVisible();
    await expect(page.getByTestId('mail-in-plan').first()).toBeVisible();
    // No second action anywhere: the row and the open thread both say where it is.
    await expect(row).toHaveCount(0);
    await page.getByText('Wochenende?').first().click();
    await expect(page.getByTestId('mail-plan-thread')).toHaveCount(0);
    await expect(page.getByText(/^(Im Plan|Als ToDo da)$/)).toBeVisible();
    // The ToDo carries the way back: a mail link, never an address.
    await page.goto('/todos');
    await expect(page.getByText('Anna Beispiel · Wochenende?').first()).toBeVisible();
  });

  test('filter „Persönlich“ shows people only, without a count; „Alle in den Plan…“ previews first', async ({
    page,
  }) => {
    await page.goto('/mail');
    const chip = page.getByRole('button', { name: 'Persönlich' });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Wochenende?')).toBeVisible();
    await expect(page.getByText('Ihre Rechnung für Oktober')).toHaveCount(0);
    await chip.click();
    await page.getByTestId('mail-plan-all-open').click();
    const dialog = page.getByRole('dialog');
    const list = dialog.getByTestId('mail-plan-all');
    // Personal senders ticked, bulk / invoice senders not; nothing written before the button.
    await expect(list.getByRole('checkbox', { name: /Anna Beispiel/ })).toBeChecked();
    await expect(
      list.getByRole('checkbox', { name: /Stadtwerke Musterstadt · Ihre Rechnung/ }),
    ).not.toBeChecked();
    const save = dialog.getByRole('button', { name: /^In den Plan \(\d+\)$/ });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText(/Mails im Plan/)).toBeVisible();
  });

  test('„Anlegen“ under an invoice mail: values first, one tap, a second tap finds it', async ({
    page,
  }) => {
    await page.goto('/mail');
    const create = page.getByRole('button', {
      name: /^Rechnung anlegen: Stadtwerke Musterstadt · 84,30/,
    });
    await expect(create).toBeVisible({ timeout: 10_000 });
    await create.click();
    await expect(page.getByText('Rechnung angelegt')).toBeVisible();
    // The line now says it is there; no second verb, so no second invoice.
    await expect(create).toHaveCount(0);
    await expect(page.getByTestId('mail-invoice-done').first()).toContainText('angelegt');
    await page.goto('/invoices');
    await expect(page.getByText('Stadtwerke Musterstadt').first()).toBeVisible();
    // The mail of a debit shows its day as text and offers nothing to create.
    await page.goto('/mail');
    const debit = page.getByTestId('mail-invoice-line').filter({ hasText: 'Abbuchung am' });
    await expect(debit).toContainText('Internetanbieter Muster · 39,99');
    await expect(debit.getByRole('button')).toHaveCount(0);
  });

  test('a payment reminder notes itself on the open invoice; amount and due stay', async ({
    page,
  }) => {
    await page.goto('/mail');
    const line = page.getByTestId('mail-invoice-line').filter({ hasText: 'Mahnung zu Rechnung' });
    await expect(line).toContainText('Stadtwerke Musterstadt');
    await expect(line).toContainText('92,40 € bis');
    await line.getByRole('button', { name: /^Mahnung vermerken:/ }).click();
    await expect(page.getByText('Mahnung vermerkt')).toBeVisible();
    await expect(line).toContainText('vermerkt');
    await expect(line.getByRole('button')).toHaveCount(0);
  });

  test('`?open=` opens a known thread and ignores anything else', async ({ page }) => {
    await page.goto('/mail?open=%3Cimg%20src%3Dx%3E');
    await expect(page).not.toHaveURL(/open=/);
    await expect(page).not.toHaveURL(/thread=/);
    await page.goto('/mail?open=no-such-thread');
    await expect(page).not.toHaveURL(/thread=/);
  });

  test('from 1200 px folders, list and mail stand side by side; below it the mail replaces the list', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/mail');
    await expect(page.getByTestId('mail-columns')).toBeVisible();
    await expect(page.getByTestId('mail-stamp')).toContainText('ungelesen');
    await expect(page.getByRole('navigation', { name: 'Ordner' })).toBeVisible();
    await page.getByText('Ihre Rechnung für Oktober').click();
    await expect(page.getByTitle(/Inhalt der Mail/)).toBeVisible();
    // the list stays next to the open mail
    await expect(page.getByText('Hausverwaltung Muster')).toBeVisible();
    await page.setViewportSize({ width: 1000, height: 900 });
    await expect(page.getByTestId('mail-columns')).toHaveCount(0);
    await expect(page.getByText('Hausverwaltung Muster')).toHaveCount(0);
  });

  test('a finished search is offered again as a suggestion (device-local)', async ({ page }) => {
    await page.goto('/mail');
    await page.getByLabel('Suchen', { exact: true }).fill('Rechnung');
    await page.getByRole('search').getByRole('button', { name: 'Suchen' }).click();
    await page.getByRole('button', { name: 'Suche beenden' }).click();
    await expect(page.locator('#mail-suggest option[value="Rechnung"]')).toBeAttached();
    expect(await page.evaluate(() => localStorage.getItem('tm-mail-searches'))).toContain(
      'Rechnung',
    );
  });

  test('the inbox widget shows the unread count, two subjects and the invoice mails', async ({
    page,
  }) => {
    await showAllWidgets(page);
    await page.goto('/');
    await expect(page.locator('main h1')).toBeVisible();
    const inbox = page.getByTestId('widget-mail:inbox');
    await expect(inbox).toContainText('ungelesen');
    await expect(inbox).toContainText('Ihre Rechnung für Oktober');
    // „Kopf leer“ 3b: the count got a verb and is the way to the list.
    await expect(inbox.getByRole('link', { name: /Rechnung(en)? zum Anlegen/ })).toBeVisible();
  });

  test('new-mail notifications are off by default and their switch is in the module settings', async ({
    page,
  }) => {
    await page.goto('/settings/module/mail');
    const section = page.locator('section[aria-labelledby="module-mail"]');
    await expect(section).toBeVisible();
    const notify = section
      .getByRole('switch', { name: /Bei neuen Mails benachrichtigen/ })
      .or(section.getByRole('checkbox', { name: /Bei neuen Mails benachrichtigen/ }));
    await expect(notify).not.toBeChecked();
    await expect(section.getByText(/nur, solange die App läuft/)).toBeVisible();
    await expect(section.getByLabel('Absender in der Benachrichtigung zeigen')).not.toBeChecked();
  });

  test('the local model may not read mail until switched on, and the button is absent', async ({
    page,
  }) => {
    await page.goto('/settings/module/mail');
    const section = page.locator('section[aria-labelledby="module-mail"]');
    await expect(section.getByLabel('Lokales Modell darf Mails lesen')).not.toBeChecked();
    await page.goto('/mail');
    await page.getByText('Ihre Rechnung für Oktober').click();
    await expect(page.getByTitle(/Inhalt der Mail/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kurz zusammenfassen' })).toHaveCount(0);
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
      // create from this mail: the menu and the prefilled preview dialog
      await page.getByRole('button', { name: 'Aus dieser Mail anlegen' }).click();
      await page.getByRole('menuitem', { name: 'Rechnung' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByTestId('capture-chips')).toContainText('84,30');
      await audit(page, `create dialog (${scheme})`);
      if (out)
        await page.screenshot({ path: `${out}/mail-create-${info.project.name}-${scheme}.png` });
    });
  }
});
