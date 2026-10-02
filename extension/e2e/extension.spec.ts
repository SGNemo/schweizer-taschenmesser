import { existsSync, readFileSync } from 'node:fs';
import { PHISH, SHOP } from './pages';
import { expect, test, type Env } from './fixtures';
import type { Page } from '@playwright/test';

/** First contact: the popup shows a code, the user confirms it in the app. */
async function pair(env: Env) {
  const popup = await env.popup();
  await expect(popup.getByTestId('popup-status')).toContainText('Bestätige die Verbindung');
  const dialog = env.app.getByRole('dialog', { name: 'Erweiterung verbinden?' });
  await expect(dialog).toBeVisible();
  const code = (await dialog.locator('code').textContent()) ?? '';
  expect(code).toMatch(/^\d{6}$/);
  await expect(popup.getByTestId('popup-status')).toContainText(code); // same code on both sides
  await dialog.getByRole('button', { name: 'Verbinden' }).click();
  await popup.reload();
  await expect(popup.getByTestId('popup-status')).toContainText('Verbunden');
  await popup.close();
}

/** Registers on the test shop through the overlay and returns the password that was used. */
async function register(
  env: Env,
  email = 'alice@example.test',
  title = 'Beispiel-Shop',
): Promise<{ page: Page; password: string }> {
  const page = await env.context.newPage();
  await page.goto(`${SHOP}/signup`);
  await page.fill('#email', email);
  await page.click('#pw');
  const suggested = page.getByTestId('nemo-suggested');
  await expect(suggested).toBeVisible();
  const password = ((await suggested.textContent()) ?? '').trim();
  expect(password.length).toBeGreaterThanOrEqual(16);
  await page.getByTestId('nemo-use').click();
  await expect(page.locator('#pw')).toHaveValue(password);
  await expect(page.locator('#pw2')).toHaveValue(password);
  await expect(page.locator('#other')).toHaveValue('');
  await expect(page.locator('#email')).toHaveValue(email);
  await expect(page.getByTestId('nemo-username')).toHaveValue(email);
  await page.getByTestId('nemo-title').fill(title);
  return { page, password };
}

test.describe('registration', () => {
  test('suggest → use → save: the account lands in the app vault', async ({ env }) => {
    await pair(env);
    const { page, password } = await register(env);
    await page.getByTestId('nemo-save').click();
    await expect(page.getByTestId('nemo-status')).toHaveText('Im Tresor gespeichert.');

    // In the app: a normal vault entry with the page's origin as URL and the same password.
    await env.app.bringToFront();
    await env.app
      .getByRole('button', { name: /Beispiel-Shop/ })
      .first()
      .click();
    await env.app.getByRole('button', { name: 'Anzeigen' }).first().click();
    await expect(env.app.getByTestId('password-value').first()).toHaveText(password);
    await expect(env.app.getByText('https://shop.example.test').first()).toBeVisible();
  });

  test('"Später erinnern" keeps it for the next page of this tab, "Verwerfen" clears it', async ({
    env,
  }) => {
    await pair(env);
    const { page } = await register(env);
    await page.getByRole('button', { name: 'Später erinnern' }).click();
    await page.goto(`${SHOP}/welcome`);
    await expect(page.getByTestId('nemo-save')).toBeVisible(); // offered again, same tab
    await page.getByRole('button', { name: 'Verwerfen' }).click();
    await page.goto(`${SHOP}/welcome`);
    await expect(page.getByTestId('nemo-save')).toHaveCount(0);
  });

  test('a locked app keeps the data in the extension memory until it is unlocked', async ({
    env,
  }) => {
    await pair(env);
    const { page } = await register(env);
    await env.app.bringToFront();
    await env.app.getByRole('button', { name: 'Sperren' }).click();
    await page.bringToFront();
    await page.getByTestId('nemo-save').click();
    await expect(page.getByTestId('nemo-status')).toContainText('Tresor gesperrt');

    await env.app.bringToFront();
    await env.app.getByLabel('Master-Passwort', { exact: true }).fill('Mein-Master-Passwort-1');
    await env.app.getByRole('button', { name: 'Entsperren' }).click();
    await expect(env.app.getByRole('button', { name: 'Zugang hinzufügen' })).toBeVisible({
      timeout: 20_000,
    });
    await page.bringToFront();
    await page.getByTestId('nemo-save').click(); // "Erneut versuchen"
    await expect(page.getByTestId('nemo-status')).toHaveText('Im Tresor gespeichert.');
  });

  test('an app that is not running is reported, nothing is lost', async ({ env }) => {
    await pair(env);
    const { page } = await register(env);
    await env.app.bringToFront();
    await env.app.getByRole('button', { name: 'Browser-Erweiterung', exact: true }).click();
    await env.app.getByLabel('Verbindung zur Browser-Erweiterung aktivieren').click(); // off: nothing listens
    await env.app.keyboard.press('Escape');
    await page.bringToFront();
    await page.getByTestId('nemo-save').click();
    await expect(page.getByTestId('nemo-status')).toContainText('nicht gefunden');
  });
});

test.describe('submitted forms', () => {
  test('an unknown login is offered for saving after submit, only after a click it is stored', async ({
    env,
  }) => {
    await pair(env);
    const page = await env.context.newPage();
    await page.goto(`${SHOP}/login`);
    await page.fill('#user', 'bob@example.test');
    await page.fill('#pw', 'Bobs-Passwort-4711'); // gitleaks:allow (invented fixture)
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByTestId('nemo-save')).toBeVisible();
    await expect(page.getByText('Diesen Login im Tresor speichern?')).toBeVisible();
    await expect(env.app.getByRole('button', { name: /bob@example.test/ })).toHaveCount(0); // not yet
    await page.getByTestId('nemo-save').click();
    await expect(page.getByTestId('nemo-status')).toHaveText('Im Tresor gespeichert.');
    await expect(env.app.getByRole('button', { name: /bob@example.test/ }).first()).toBeVisible();
  });
});

test.describe('login autofill', () => {
  test('fills only after a click in the overlay', async ({ env }) => {
    await pair(env);
    const { page: signup, password } = await register(env, 'carol@example.test');
    await signup.getByTestId('nemo-save').click();
    await expect(signup.getByTestId('nemo-status')).toHaveText('Im Tresor gespeichert.');
    await signup.close();

    const page = await env.context.newPage();
    await page.goto(`${SHOP}/login`);
    await page.waitForTimeout(500);
    await expect(page.locator('#pw')).toHaveValue(''); // never on page load
    await page.click('#pw');
    await expect(page.locator('#pw')).toHaveValue(''); // not on focus either
    await page.getByTestId('nemo-key').click();
    await page.getByRole('button', { name: /carol@example.test/ }).click();
    await expect(page.locator('#user')).toHaveValue('carol@example.test');
    await expect(page.locator('#pw')).toHaveValue(password);
  });

  test('fills a TOTP code into a code field when the entry has one', async ({ env }) => {
    await pair(env);
    await env.app.bringToFront();
    await env.app.getByRole('button', { name: 'Zugang hinzufügen' }).click();
    const form = env.app.getByRole('dialog', { name: 'Zugang hinzufügen' });
    await form.getByLabel('Name', { exact: true }).fill('Shop mit Code');
    await form.getByLabel('Benutzername').fill('dave@example.test');
    await form.getByLabel('Passwort', { exact: true }).fill('Daves-Passwort-4711'); // gitleaks:allow
    await form.getByLabel('Website').fill('https://shop.example.test');
    await form.getByLabel('Einmalcode (TOTP)').fill('JBSWY3DPEHPK3PXP');
    await form.getByRole('button', { name: 'Speichern' }).click();

    const page = await env.context.newPage();
    await page.goto(`${SHOP}/login`);
    await page.click('#otp');
    await page.getByTestId('nemo-key').click();
    await page.getByRole('button', { name: /dave@example.test/ }).click();
    await expect(page.locator('#otp')).toHaveValue(/^\d{6}$/);
  });

  test('a look-alike domain gets nothing', async ({ env }) => {
    await pair(env);
    const { page: signup } = await register(env, 'erin@example.test');
    await signup.getByTestId('nemo-save').click();
    await expect(signup.getByTestId('nemo-status')).toHaveText('Im Tresor gespeichert.');
    await signup.close();

    const phishing = await env.context.newPage();
    await phishing.goto(`${PHISH}/login`);
    await phishing.click('#pw');
    await phishing.getByTestId('nemo-key').click();
    await expect(phishing.getByText('Kein Eintrag für diese Seite.')).toBeVisible();
    await expect(phishing.locator('#pw')).toHaveValue('');
    await expect(phishing.locator('#user')).toHaveValue('');
    expect(await phishing.content()).not.toContain('erin@example.test');
  });
});

test.describe('connection', () => {
  test('an unconfirmed extension is told to confirm, a declined one is rejected', async ({
    env,
  }) => {
    const popup = await env.popup();
    await expect(popup.getByTestId('popup-status')).toContainText('Bestätige die Verbindung');
    await env.app
      .getByRole('dialog', { name: 'Erweiterung verbinden?' })
      .getByRole('button', { name: 'Ablehnen' })
      .click();
    await popup.reload();
    await expect(popup.getByTestId('popup-status')).toContainText('nicht zugelassen');
  });

  test('a locked vault is shown, and no entries are listed', async ({ env }) => {
    await pair(env);
    await env.app.getByRole('button', { name: 'Sperren' }).click();
    const popup = await env.popup();
    await expect(popup.getByTestId('popup-status')).toContainText('Tresor gesperrt');
    await expect(popup.getByTestId('popup-empty')).toHaveCount(0);
  });

  test('the extension keeps nothing in browser storage', async ({ env }) => {
    await pair(env);
    const { page } = await register(env);
    await page.getByTestId('nemo-save').click();
    await expect(page.getByTestId('nemo-status')).toHaveText('Im Tresor gespeichert.');
    const popup = await env.popup();
    const stores = await popup.evaluate(async () => ({
      local: window.localStorage.length,
      session: window.sessionStorage.length,
      databases: (await indexedDB.databases()).length,
      chromeStorage: typeof (chrome as unknown as { storage?: unknown }).storage,
    }));
    expect(stores).toEqual({ local: 0, session: 0, databases: 0, chromeStorage: 'undefined' });
  });

  test('the release build uses a closed shadow root', () => {
    test.skip(!existsSync('dist/content.js'), 'run `npm run build` first');
    expect(readFileSync('dist/content.js', 'utf8')).toMatch(/mode:\s*["']closed["']/);
  });
});
