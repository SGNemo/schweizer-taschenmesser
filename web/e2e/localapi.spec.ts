import { expect, test, type Page } from '@playwright/test';

/**
 * Settings → KI-Zugriff with the e2e stand-in for the native server (`core/platform/fakeLocalApi.ts`):
 * the token check and the app handler are the real ones; transport checks live in the Rust tests.
 */
interface Call {
  method: string;
  path: string;
  query?: string;
  body?: unknown;
  token?: string;
}

/* The JSON bodies are checked field by field below. */
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function api(page: Page, call: Call): Promise<{ status: number; body: Json }> {
  return page.evaluate(
    (c) =>
      (
        window as unknown as {
          __tmLocalApi: { request(c: unknown): Promise<{ status: number; body: unknown }> };
        }
      ).__tmLocalApi.request(c),
    call,
  ) as Promise<{ status: number; body: Json }>;
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

test('KI-Zugriff: enable, create a token, use it, revoke it', async ({ page }) => {
  await page.goto('/settings');
  const section = page.locator('section[aria-labelledby="localapi"]');
  await expect(section.getByRole('status')).toHaveText('Aus');
  await section.getByRole('switch', { name: 'Lokale Schnittstelle aktivieren' }).click();
  await expect(section.getByRole('status')).toHaveText('Läuft auf http://127.0.0.1:47631');

  await section.getByRole('button', { name: 'Zugang anlegen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Zugang anlegen' });
  // Nothing is granted by default.
  await dialog.getByRole('button', { name: 'Anlegen' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Bitte einen Namen angeben.');
  await dialog.getByLabel('Name').fill('Claude Code');
  await dialog.getByRole('button', { name: 'Anlegen' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Bitte mindestens ein Recht vergeben.');
  await dialog.getByRole('checkbox', { name: 'ToDos: Lesen' }).click();
  await dialog.getByRole('checkbox', { name: 'ToDos: Schreiben' }).click();
  await dialog.getByRole('button', { name: 'Anlegen' }).click();

  const shown = page.getByRole('dialog', { name: 'Zugang anlegen' });
  const token = (await shown.getByTestId('new-token').textContent())!.trim();
  expect(token).toMatch(/^tm_/);
  await shown.getByRole('button', { name: 'Fertig' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Shown once: the page no longer contains it.
  await expect(page.getByText(token)).toHaveCount(0);
  await expect(section.getByText('Claude Code', { exact: true })).toBeVisible();
  await expect(section.getByText('ToDos: lesen + schreiben')).toBeVisible();

  const modules = await api(page, { method: 'GET', path: '/v1/modules', token });
  expect(modules.status).toBe(200);
  expect(modules.body.modules.map((m: { id: string }) => m.id)).toEqual(['todos']);
  expect(JSON.stringify(modules.body)).not.toContain('accounts');

  const check = await api(page, {
    method: 'POST',
    path: '/v1/todos/import',
    query: 'dryRun=true',
    token,
    body: { items: [{ collection: 'task', title: 'Steuer machen', dueDate: '2026-10-15' }] },
  });
  expect(check.status).toBe(200);
  expect(check.body.summary).toEqual({ ok: 1, update: 0, duplicate: 0, invalid: 0 });

  expect((await api(page, { method: 'GET', path: '/v1/modules', token: 'tm_wrong' })).status).toBe(
    401,
  );
  expect((await api(page, { method: 'GET', path: '/v1/notes/items', token })).status).toBe(404);

  // The access log shows the requests without content.
  await expect(section.getByRole('list', { name: 'Letzte Zugriffe' })).toContainText(
    'POST /v1/{module}/import (ToDos) · 200',
  );
  await expect(section.getByText('Steuer machen')).toHaveCount(0);

  // A real import waits for confirmation in the app.
  const sent = await api(page, {
    method: 'POST',
    path: '/v1/todos/import',
    token,
    body: {
      items: [
        { collection: 'task', title: 'Steuer machen', dueDate: '2026-10-15' },
        { collection: 'task', title: 'Fahrrad putzen' },
      ],
    },
  });
  expect(sent.status).toBe(202);
  const banner = page.getByTestId('pending-import');
  await expect(banner).toContainText('Claude Code möchte 2 Einträge in „ToDos“ übernehmen.');
  await banner.getByRole('button', { name: 'Ansehen' }).click();
  const review = page.getByRole('dialog', { name: 'Import prüfen: ToDos' });
  await review.getByRole('checkbox', { name: /Fahrrad putzen/ }).click();
  await review.getByRole('button', { name: '1 Eintrag übernehmen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(banner).toHaveCount(0);
  await expect(section.getByRole('list', { name: 'Importe über die Schnittstelle' })).toContainText(
    '1 Eintrag übernommen',
  );
  const status = await api(page, {
    method: 'GET',
    path: `/v1/batches/${sent.body.batchId}`,
    token,
  });
  expect(status.body).toMatchObject({ status: 'committed', written: 1 });
  const read = await api(page, {
    method: 'GET',
    path: '/v1/todos/items',
    query: 'collection=task',
    token,
  });
  expect(read.body.items.map((i: { title: string }) => i.title)).toEqual(['Steuer machen']);

  // Undo from the settings list.
  await section
    .getByRole('list', { name: 'Importe über die Schnittstelle' })
    .getByRole('button', { name: 'Import rückgängig machen' })
    .click();
  await expect(section.getByRole('list', { name: 'Importe über die Schnittstelle' })).toContainText(
    'rückgängig gemacht',
  );
  const after = await api(page, {
    method: 'GET',
    path: '/v1/todos/items',
    query: 'collection=task',
    token,
  });
  expect(after.body.items).toEqual([]);

  await section.getByRole('button', { name: 'Widerrufen' }).click();
  await page
    .getByRole('dialog', { name: 'Widerrufen' })
    .getByRole('button', { name: 'Widerrufen' })
    .click();
  await expect(section.getByText('Claude Code', { exact: true })).toHaveCount(0);
  expect((await api(page, { method: 'GET', path: '/v1/modules', token })).status).toBe(401);

  await section.getByRole('switch', { name: 'Lokale Schnittstelle aktivieren' }).click();
  await expect(section.getByRole('status')).toHaveText('Aus');
});
