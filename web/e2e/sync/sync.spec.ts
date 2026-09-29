import { expect, test } from '@playwright/test';
import {
  addTask,
  connect,
  newDevice,
  openSettings,
  outboxCount,
  resetServer,
  SERVER,
  serverDump,
  submitConnect,
  TOKEN,
  syncNow,
} from './helpers';

test.beforeEach(async ({ request }) => {
  await resetServer(request);
});

test.describe('two devices', () => {
  test('a task created on one device appears on the other; edits and deletes follow', async ({
    browser,
  }) => {
    const a = await newDevice(browser);
    const b = await newDevice(browser);

    await addTask(a.page, 'Milch kaufen');
    await connect(a.page);
    await expect(a.page.getByTestId('sync-badge')).toHaveAttribute('data-phase', 'idle');

    await connect(b.page);
    await b.page.goto('/todos?list=inbox');
    const onB = b.page.getByRole('checkbox', { name: 'Milch kaufen' });
    await expect(onB).toBeVisible();
    await expect(onB).not.toBeChecked();

    // B completes it, A receives the change
    await onB.click();
    await expect(onB).toBeChecked();
    await syncNow(b.page);
    await syncNow(a.page);
    await a.page.goto('/todos?list=inbox');
    await expect(a.page.getByRole('checkbox', { name: 'Milch kaufen' })).toBeChecked();

    // A deletes it, B no longer shows it
    await a.page.getByRole('button', { name: /Milch kaufen/ }).click();
    await a.page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
    await expect(a.page.getByRole('dialog')).toHaveCount(0);
    await syncNow(a.page);
    await syncNow(b.page);
    await b.page.goto('/todos');
    await expect(b.page.getByText('Nichts zu tun – gut so.')).toBeVisible();

    await a.context.close();
    await b.context.close();
  });

  test('offline edits of different fields on both devices merge', async ({ browser }) => {
    const a = await newDevice(browser);
    const b = await newDevice(browser);
    await addTask(a.page, 'Brot');
    await connect(a.page);
    await connect(b.page);
    await b.page.goto('/todos?list=inbox');
    await expect(b.page.getByRole('checkbox', { name: 'Brot' })).toBeVisible();

    // B goes offline and ticks the task; A renames it meanwhile.
    await b.context.setOffline(true);
    await b.page.getByRole('checkbox', { name: 'Brot' }).click();
    await expect(b.page.getByRole('checkbox', { name: 'Brot' })).toBeChecked();

    await a.page.goto('/todos?list=inbox');
    await a.page.getByRole('button', { name: /Brot/ }).click();
    await a.page.getByRole('dialog').getByLabel('Titel').fill('Vollkornbrot');
    await a.page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
    await expect(a.page.getByRole('dialog')).toHaveCount(0);
    await syncNow(a.page);

    // B is still offline: the badge shows the problem and the change stays queued
    // (client-side navigation: a page load would fail while the browser is offline)
    await b.page.getByRole('link', { name: 'Einstellungen' }).click();
    await b.page.getByRole('button', { name: 'Jetzt synchronisieren' }).click();
    await expect(b.page.getByTestId('sync-status')).toContainText('Fehler');
    await expect(b.page.getByRole('alert')).toHaveText('Server nicht erreichbar.');
    await expect(b.page.getByTestId('sync-badge')).toHaveAttribute('data-phase', 'error');
    expect(await outboxCount(b.page)).toBeGreaterThan(0);

    await b.context.setOffline(false);
    await syncNow(b.page);
    await syncNow(a.page);

    for (const d of [a, b]) {
      await d.page.goto('/todos?list=inbox');
      await expect(d.page.getByRole('checkbox', { name: 'Vollkornbrot' })).toBeChecked();
    }
    await a.context.close();
    await b.context.close();
  });

  test('module activation is synced too', async ({ browser }) => {
    const a = await newDevice(browser);
    const b = await newDevice(browser);
    await connect(a.page);
    await connect(b.page);

    await a.page.goto('/library');
    const card = a.page.getByTestId('module-example');
    await card.getByRole('button', { name: 'Aktivieren' }).click();
    await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();
    await syncNow(a.page);
    await syncNow(b.page);

    await b.page.goto('/library');
    await expect(
      b.page.getByTestId('module-example').getByText('Aktiv', { exact: true }),
    ).toBeVisible();
    await expect(
      b.page
        .getByRole('navigation', { name: 'Hauptnavigation' })
        .getByRole('link', { name: 'Beispiel' }),
    ).toBeVisible();
    await a.context.close();
    await b.context.close();
  });

  test('a paid invoice books its expense on the other device as well', async ({ browser }) => {
    const a = await newDevice(browser);
    const b = await newDevice(browser);
    await connect(a.page);
    await connect(b.page);

    await a.page.goto('/invoices?new=1');
    const dialog = a.page.getByRole('dialog');
    await dialog.getByLabel('Empfänger', { exact: true }).fill('Stadtwerke');
    await dialog.getByLabel('Betrag').fill('89,90');
    await dialog.getByLabel('Fällig am').fill('2030-01-05');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(a.page.getByRole('dialog')).toHaveCount(0);
    await a.page.getByRole('button', { name: 'Als bezahlt markieren' }).click();
    await expect(a.page.getByText('Als bezahlt markiert.')).toBeVisible();
    // Finance's module service books the expense on A; invoice and booking then travel to B.
    await syncNow(a.page);
    await syncNow(b.page);

    await b.page.goto('/invoices');
    await b.page.getByRole('button', { name: 'Bezahlt', exact: true }).click();
    await expect(b.page.getByRole('button', { name: /Stadtwerke/ })).toBeVisible();
    await b.page.goto('/finance?tab=transactions');
    await expect(b.page.getByRole('button', { name: /Stadtwerke/ })).toContainText(/−89,90\s€/);
    // Only one booking, even though both devices ran the finance service for the event.
    await expect(b.page.getByRole('button', { name: /Stadtwerke/ })).toHaveCount(1);
    await a.context.close();
    await b.context.close();
  });
});

test.describe('connecting', () => {
  test('shows clear errors for a wrong token and an unreachable server', async ({ browser }) => {
    const { page, context } = await newDevice(browser);
    await submitConnect(page, { token: 'definitely-wrong-token' });
    await expect(page.getByTestId('sync-failure')).toHaveText('Das Token wurde abgelehnt.');
    await submitConnect(page, { url: 'http://127.0.0.1:9' });
    await expect(page.getByTestId('sync-failure')).toContainText('Server nicht erreichbar');
    await submitConnect(page, { url: 'ftp://server' });
    await expect(page.getByTestId('sync-failure')).toContainText('gültige Adresse');
    await expect(page.getByTestId('sync-badge')).toHaveCount(0);
    await context.close();
  });

  test('disconnecting keeps the local data and can be undone by connecting again', async ({
    browser,
  }) => {
    const { page, context } = await newDevice(browser);
    await addTask(page, 'bleibt lokal');
    await connect(page);
    await page.getByRole('button', { name: 'Trennen' }).click();
    await expect(page.getByLabel('Server-Adresse')).toBeVisible();
    await expect(page.getByTestId('sync-badge')).toHaveCount(0);
    await page.goto('/todos');
    await expect(page.getByRole('checkbox', { name: 'bleibt lokal' })).toBeVisible();
    await connect(page);
    expect((await serverDump(context.request)).ops.length).toBeGreaterThan(0);
    await context.close();
  });

  test('the connection survives a reload and syncs by itself after local changes', async ({
    browser,
    request,
  }) => {
    const { page, context } = await newDevice(browser);
    await connect(page);
    await page.reload();
    await expect(page.getByTestId('sync-status')).toContainText('Verbunden mit 127.0.0.1:8787');
    await addTask(page, 'automatisch');
    // No manual sync: the debounced auto-sync pushes it.
    await expect.poll(() => outboxCount(page), { timeout: 15_000 }).toBe(0);
    expect((await serverDump(request)).ops.length).toBeGreaterThan(0);
    await context.close();
  });
});

test.describe('end-to-end encryption', () => {
  test('the server sees only ciphertext; other devices need the right passphrase', async ({
    browser,
    request,
  }) => {
    const a = await newDevice(browser);
    const b = await newDevice(browser);
    await addTask(a.page, 'Geheime Steuernummer 12345');
    await connect(a.page, { encrypt: true, passphrase: 'ein langer geheimer Satz' });
    await expect(a.page.getByTestId('sync-status')).toContainText('Verschlüsselt');

    const { text, ops } = await serverDump(request);
    expect(ops.length).toBeGreaterThan(3);
    expect(text).not.toMatch(/Geheime|Steuernummer|12345/);
    expect(ops.every((o) => typeof o.value === 'string' && o.value.startsWith('enc:v1:'))).toBe(
      true,
    );

    // Device B: no passphrase → asked for it; wrong → rejected; right → data arrives
    await submitConnect(b.page);
    await expect(b.page.getByTestId('sync-failure')).toContainText('verschlüsselt');
    await b.page.getByLabel('Passphrase').fill('falsche passphrase');
    await b.page.getByRole('button', { name: 'Verbinden', exact: true }).click();
    await expect(b.page.getByTestId('sync-failure')).toHaveText('Falsche Passphrase.');
    await b.page.getByLabel('Passphrase').fill('ein langer geheimer Satz');
    await b.page.getByRole('button', { name: 'Verbinden', exact: true }).click();
    await expect(b.page.getByTestId('sync-status')).toContainText('Synchronisiert');
    await b.page.goto('/todos');
    await expect(
      b.page.getByRole('checkbox', { name: 'Geheime Steuernummer 12345' }),
    ).toBeVisible();

    // The key survives a reload (stored as a non-extractable key, not as the passphrase)
    await b.page.reload();
    await addTask(b.page, 'Nach dem Reload');
    await syncNow(b.page);
    await syncNow(a.page);
    await a.page.goto('/todos');
    await expect(a.page.getByRole('checkbox', { name: 'Nach dem Reload' })).toBeVisible();
    expect((await serverDump(request)).text).not.toMatch(/Nach dem Reload/);
    await a.context.close();
    await b.context.close();
  });

  test('a passphrase must be long enough', async ({ browser }) => {
    const { page, context } = await newDevice(browser);
    await submitConnect(page, { encrypt: true, passphrase: 'kurz' });
    await expect(page.getByTestId('sync-failure')).toContainText('mindestens 8 Zeichen');
    await context.close();
  });

  test('encryption on a server that already holds plain data needs an explicit reset', async ({
    browser,
    request,
  }) => {
    const a = await newDevice(browser);
    const b = await newDevice(browser);
    await addTask(a.page, 'lag unverschlüsselt');
    await connect(a.page);
    expect((await serverDump(request)).text).toContain('lag unverschlüsselt');

    await addTask(b.page, 'Neuer Start');
    await submitConnect(b.page, { encrypt: true, passphrase: 'ein langer geheimer Satz' });
    await expect(b.page.getByTestId('sync-failure')).toContainText(
      'bereits unverschlüsselte Daten',
    );
    await b.page
      .getByRole('button', { name: 'Server zurücksetzen und verschlüsselt neu aufbauen' })
      .click();
    await b.page.getByRole('dialog').getByRole('button', { name: 'Zurücksetzen' }).click();
    await expect(b.page.getByTestId('sync-status')).toContainText('Verschlüsselt');

    const { text, ops } = await serverDump(request);
    expect(text).not.toContain('lag unverschlüsselt');
    expect(text).not.toContain('Neuer Start');
    expect(ops.every((o) => typeof o.value === 'string' && o.value.startsWith('enc:v1:'))).toBe(
      true,
    );

    // Device A notices the new (encrypted) server and asks to be reconnected with the passphrase
    await openSettings(a.page);
    await a.page.getByRole('button', { name: 'Jetzt synchronisieren' }).click();
    await expect(a.page.getByTestId('sync-status')).toContainText('verschlüsselt');
    await a.page.getByRole('button', { name: 'Trennen' }).click();
    await connect(a.page, { passphrase: 'ein langer geheimer Satz' });
    await a.page.goto('/todos');
    await expect(a.page.getByRole('checkbox', { name: 'Neuer Start' })).toBeVisible();
    await expect(a.page.getByRole('checkbox', { name: 'lag unverschlüsselt' })).toBeVisible();
    // ...and B receives what A still had.
    await syncNow(a.page);
    await syncNow(b.page);
    await b.page.goto('/todos');
    await expect(b.page.getByRole('checkbox', { name: 'lag unverschlüsselt' })).toBeVisible();
    await a.context.close();
    await b.context.close();
  });
});

test.describe('password vault', () => {
  const MASTER = 'Mein-Master-Passwort-1';
  const TITLE = 'Sync-Konto-Geheim';
  const PASSWORD = 'sync-passwort-geheim-99';

  test('a second device unlocks the same vault with the master password; the server only sees ciphertext', async ({
    browser,
    request,
  }) => {
    const a = await newDevice(browser);
    const b = await newDevice(browser);

    // A: enable, set up, add an entry
    await a.page.goto('/library');
    const card = a.page.getByTestId('module-accounts');
    await card.getByRole('button', { name: 'Aktivieren' }).click();
    await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();
    await a.page.goto('/accounts');
    await a.page.getByLabel('Master-Passwort', { exact: true }).fill(MASTER);
    await a.page.getByLabel('Master-Passwort wiederholen').fill(MASTER);
    await a.page.getByRole('button', { name: 'Tresor erstellen' }).click();
    await expect(a.page.getByRole('button', { name: 'Zugang hinzufügen' })).toBeVisible({
      timeout: 20_000,
    });
    await a.page.getByRole('button', { name: 'Zugang hinzufügen' }).click();
    const form = a.page.getByRole('dialog', { name: 'Zugang hinzufügen' });
    await form.getByLabel('Name', { exact: true }).fill(TITLE);
    await form.getByLabel('Passwort', { exact: true }).fill(PASSWORD);
    await form.getByRole('button', { name: 'Speichern' }).click();
    await expect(a.page.getByRole('dialog', { name: 'Zugang hinzufügen' })).toHaveCount(0);
    await expect.poll(() => outboxCount(a.page)).toBeGreaterThan(0);

    await connect(a.page);
    await syncNow(a.page);

    // The server holds ciphertext (and the vault header), never a title, password or the master password.
    const { text } = await serverDump(request);
    expect(text).toContain('accounts_entry');
    for (const secret of [TITLE, PASSWORD, MASTER]) expect(text, secret).not.toContain(secret);

    // B: sync, then unlock the very same vault – no second setup is offered
    await connect(b.page);
    await b.page.goto('/accounts');
    await expect(b.page.getByRole('button', { name: 'Tresor erstellen' })).toHaveCount(0);
    await b.page.getByLabel('Master-Passwort').fill(MASTER);
    await b.page.getByRole('button', { name: 'Entsperren' }).click();
    await expect(b.page.getByRole('listitem').filter({ hasText: TITLE })).toBeVisible({
      timeout: 20_000,
    });

    await a.context.close();
    await b.context.close();
  });
});

test.describe('web push API of the real server', () => {
  const headers = { authorization: `Bearer ${TOKEN}` };
  const endpoint = 'https://push.example.test/send/e2e';

  test('key, subscription and schedule endpoints work and are protected', async ({ request }) => {
    expect((await request.get(`${SERVER}/v1/push/key`)).status()).toBe(401);
    const { publicKey } = (await (
      await request.get(`${SERVER}/v1/push/key`, { headers })
    ).json()) as {
      publicKey: string;
    };
    expect(publicKey).toMatch(/^[A-Za-z0-9_-]{87}$/);

    const sub = await request.put(`${SERVER}/v1/push/subscription`, {
      headers,
      data: { endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } },
    });
    expect(sub.ok()).toBe(true);
    const schedule = await request.put(`${SERVER}/v1/push/schedule`, {
      headers,
      data: {
        endpoint,
        items: [{ key: 'k', at: Date.now() + 3600_000, payload: '{"title":"x"}' }],
      },
    });
    expect(await schedule.json()).toEqual({ stored: 1 });
    expect(
      (await request.post(`${SERVER}/v1/push/unsubscribe`, { headers, data: { endpoint } })).ok(),
    ).toBe(true);
  });
});
