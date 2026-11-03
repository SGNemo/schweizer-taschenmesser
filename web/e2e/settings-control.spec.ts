import { expect, test } from '@playwright/test';
import { ready } from './helpers';

const isPhone = (info: { project: { name: string } }) => info.project.name === 'pixel-7';

test('Barrierefreiheit: its own category with text size, motion and reading aid in one place', async ({
  page,
}, info) => {
  await ready(page, '/settings/barrierefreiheit');
  if (!isPhone(info)) {
    await expect(
      page
        .getByRole('navigation', { name: 'Einstellungs-Kategorien' })
        .getByRole('link', { name: 'Barrierefreiheit' }),
    ).toBeVisible();
  }
  const section = page.locator('section[aria-labelledby="accessibility"]');
  await expect(section).toBeVisible();
  await section
    .getByRole('group', { name: 'Textgröße' })
    .getByRole('button', { name: 'Groß', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');
  // Focus aids live here now, too.
  await expect(page.locator('section[aria-labelledby="focus"]')).toBeVisible();
});

test('links to Lesehilfe and Fokus from before the move still arrive', async ({ page }) => {
  await ready(page, '/settings/darstellung#focus');
  await expect(page).toHaveURL(/\/settings\/barrierefreiheit#focus$/);
  await expect(page.locator('section[aria-labelledby="focus"]')).toBeVisible();
  await page.goto('/settings#focus');
  await expect(page).toHaveURL(/\/settings\/barrierefreiheit#focus$/);
});

test('Meldungen pro Modul: a module is switched off for one channel, kept after a reload', async ({
  page,
}) => {
  await ready(page, '/settings/benachrichtigungen#notification-sources');
  await expect(page.getByTestId('advanced-fold-benachrichtigungen')).toHaveAttribute('open', '');
  const rows = page.locator('[data-testid^="notify-row-"]');
  await expect(rows.first()).toBeVisible();
  const first = rows.first();
  const alert = first.getByRole('switch').nth(1);
  await expect(alert).toBeChecked();
  await alert.click();
  await expect(alert).not.toBeChecked();
  await expect(first.getByRole('switch').nth(0)).toBeChecked(); // the bell stays on
  await ready(page, '/settings/benachrichtigungen#notification-sources');
  await expect(rows.first().getByRole('switch').nth(1)).not.toBeChecked();
  // Switching it on again leaves nothing behind.
  await rows.first().getByRole('switch').nth(1).click();
  await expect(rows.first().getByRole('switch').nth(1)).toBeChecked();
});

test('Speicher: shows the figures and empties only the runtime cache, after a confirmation', async ({
  page,
}) => {
  await ready(page, '/settings/allgemein#storage');
  const section = page.locator('section[aria-labelledby="storage"]');
  await expect(section).toBeVisible();
  await expect(section.getByText('Einträge je Modul')).toBeVisible();
  // One file in the runtime cache, as the service worker would keep it.
  await page.evaluate(async () => {
    const c = await caches.open('nemo-lazy-v1');
    await c.put('/assets/x-test.js', new Response('x'));
  });
  await page.reload(); // same URL: a plain goto would not reload
  await expect(section.getByText('1 gemerkte Datei')).toBeVisible();
  await section.getByTestId('cache-clear').click();
  await expect(section.getByText(/Die App selbst bleibt offline nutzbar/)).toBeVisible();
  await section.getByTestId('cache-clear-yes').click();
  await expect(page.getByText('1 Datei entfernt').first()).toBeVisible();
  await expect(section.getByText('Nichts zwischengespeichert.')).toBeVisible();
  const left = await page.evaluate(async () => (await caches.keys()).includes('nemo-lazy-v1'));
  expect(left).toBe(false);
});

test('Tastenkürzel: the fixed shortcuts are listed and cannot be mistaken for the assignable ones', async ({
  page,
}) => {
  await ready(page, '/settings/allgemein#shortcuts');
  const fixed = page.getByTestId('shortcut-fixed');
  await expect(fixed).toContainText('Suche und Befehle öffnen');
  await expect(fixed).toContainText('Strg');
  await expect(page.getByTestId('shortcuts-reset-all')).toHaveCount(0); // everything is at the default
});

test('the new sections are found by the search', async ({ page }) => {
  await ready(page, '/settings');
  const search = page.getByRole('searchbox', { name: 'Einstellungen durchsuchen' });
  await search.fill('Speicherplatz');
  await expect(page.getByRole('link', { name: /Speicher/ }).first()).toBeVisible();
  await search.fill('Sehhilfe');
  await expect(page.getByRole('link', { name: /Barrierefreiheit/ }).first()).toBeVisible();
});
