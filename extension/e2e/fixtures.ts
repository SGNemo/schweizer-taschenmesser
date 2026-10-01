import { chromium, expect, test as base, type BrowserContext, type Page } from '@playwright/test';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { EXTENSION_ID, HOST_NAME } from '../../packages/vault-core/src/protocol';
import { OTHER, PHISH, SHOP, loginPage, signupPage, welcomePage } from './pages';

export const MASTER = 'Mein-Master-Passwort-1';
const executablePath =
  process.env.PW_CHROMIUM_PATH ??
  (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

export interface Env {
  context: BrowserContext;
  /** The real Nemo web app (e2e build) with the vault; the extension talks to this page. */
  app: Page;
  /** Opens the extension popup as a tab. */
  popup(): Promise<Page>;
}

async function setUpVault(app: Page) {
  await app.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
  await app.goto('http://localhost:4173/library');
  const card = app.getByTestId('module-accounts');
  await card.getByRole('button', { name: 'Aktivieren' }).click();
  await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();
  await app.goto('http://localhost:4173/accounts');
  await app.getByLabel('Master-Passwort', { exact: true }).fill(MASTER);
  await app.getByLabel('Master-Passwort wiederholen').fill(MASTER);
  await app.getByRole('button', { name: 'Tresor erstellen' }).click();
  await expect(app.getByRole('button', { name: 'Zugang hinzufügen' })).toBeVisible({
    timeout: 20_000,
  });
  await app.getByRole('button', { name: 'Browser-Erweiterung', exact: true }).click();
  const dialog = app.getByRole('dialog', { name: 'Browser-Erweiterung verbinden' });
  await dialog.getByLabel('Verbindung zur Browser-Erweiterung aktivieren').click();
  await expect(dialog.getByText('Bereit.')).toBeVisible();
  await app.keyboard.press('Escape');
}

export const test = base.extend<{ env: Env }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures need the destructuring form
  env: async ({}, use) => {
    // Relay: native host (stdio) → HTTP → the app page's e2e bridge.
    // eslint-disable-next-line prefer-const -- the relay below needs the page before it exists
    let app!: Page;
    const relay = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        void app
          .evaluate(
            (json) =>
              (
                window as unknown as {
                  __tmVaultBridge?: { request(j: string): Promise<string | null> };
                }
              ).__tmVaultBridge?.request(json) ?? null,
            body,
          )
          .then((reply) => {
            if (reply === null) {
              res.statusCode = 503;
              res.end();
            } else res.end(reply);
          })
          .catch(() => {
            res.statusCode = 503;
            res.end();
          });
      });
    });
    await new Promise<void>((ok) => relay.listen(0, '127.0.0.1', ok));
    const port = (relay.address() as { port: number }).port;

    // Native messaging host registration for this browser profile (Linux: <profile>/NativeMessagingHosts).
    const profile = mkdtempSync(join(tmpdir(), 'nemo-ext-'));
    const hosts = join(profile, 'NativeMessagingHosts');
    mkdirSync(hosts, { recursive: true });
    const wrapper = join(profile, 'host.sh');
    writeFileSync(wrapper, `#!/bin/sh\nexec node ${resolve('e2e/host.mjs')} "$@"\n`);
    chmodSync(wrapper, 0o755);
    writeFileSync(
      join(hosts, `${HOST_NAME}.json`),
      JSON.stringify({
        name: HOST_NAME,
        description: 'test host',
        path: wrapper,
        type: 'stdio',
        allowed_origins: [`chrome-extension://${EXTENSION_ID}/`],
      }),
    );

    const extension = resolve('dist-e2e');
    const context = await chromium.launchPersistentContext(profile, {
      ...(executablePath ? { executablePath } : { channel: 'chromium' as const }),
      headless: true,
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
        '--headless=new',
      ],
      env: { ...process.env, NEMO_TEST_RELAY_PORT: String(port) } as Record<string, string>,
    });
    for (const [origin, pages] of [
      [
        SHOP,
        {
          '/signup': signupPage,
          '/login': loginPage,
          '/welcome': welcomePage,
          '/home': welcomePage,
        },
      ],
      [PHISH, { '/login': loginPage, '/signup': signupPage }],
      [OTHER, { '/login': loginPage }],
    ] as const) {
      await context.route(`${origin}/**`, (route) => {
        const path = new URL(route.request().url()).pathname as keyof typeof pages;
        const html = (pages as Record<string, string>)[path] ?? welcomePage;
        return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      });
    }

    app = await context.newPage();
    await setUpVault(app);

    await use({
      context,
      app,
      async popup() {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${EXTENSION_ID}/popup.html`);
        return page;
      },
    });

    await context.close();
    relay.close();
    rmSync(profile, { recursive: true, force: true });
  },
});

export { expect };
