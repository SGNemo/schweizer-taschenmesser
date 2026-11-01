import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/**
 * "In Arbeit anzeigen" (maturity): what is `preview` is missing from the toolbox, the tool library,
 * the module library, the palette and the settings until the switch is on; then it carries the
 * badge "In Arbeit". What the user switched on stays reachable after the switch is off again.
 */

const SWITCH = 'In Arbeit anzeigen';

async function setPreview(page: Page, on: boolean) {
  await ready(page, '/settings/darstellung');
  const sw = page.getByRole('switch', { name: SWITCH });
  if ((await sw.getAttribute('aria-checked')) !== String(on)) await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', String(on));
}

function toolbar(page: Page) {
  return page.getByRole('dialog', { name: 'Werkzeuge' });
}

async function openToolbar(page: Page) {
  await page.getByRole('button', { name: 'Werkzeuge' }).first().click();
  await expect(toolbar(page)).toBeVisible();
}

/** The palette entries for `text`, without the "Frage stellen" line the assistant always offers. */
async function paletteOptions(page: Page, text: string, label: string) {
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Suchen, springen oder fragen …' }).fill(text);
  return page.getByRole('option', { name: label, exact: true });
}

test('by default a preview tool, module and section are nowhere to be found', async ({ page }) => {
  await ready(page, '/tools');
  await expect(page.getByTestId('tool-calc')).toBeVisible();
  await expect(page.getByTestId('tool-diff')).toHaveCount(0);
  await expect(page.getByTestId('tool-screenshot')).toHaveCount(0);
  await expect(page.getByText('In Arbeit', { exact: true })).toHaveCount(0);

  await openToolbar(page);
  await expect(toolbar(page).getByRole('button', { name: 'Rechner', exact: true })).toBeVisible();
  await expect(
    toolbar(page).getByRole('button', { name: 'Textvergleich', exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');

  await ready(page, '/library');
  await expect(page.getByTestId('module-todos')).toBeVisible();
  await expect(page.getByTestId('module-chat')).toHaveCount(0);
  await expect(page.getByTestId('module-maps')).toHaveCount(0);

  // The palette offers modules that are off by name; a preview module is not among them.
  await expect(
    await paletteOptions(page, 'Karten & Orte', 'Karten & Orte in der Bibliothek einschalten'),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');

  await ready(page, '/settings/verbindungen');
  await expect(page.locator('section[aria-labelledby="localapi"]')).toHaveCount(0);
  await expect(page.locator('section[aria-labelledby="network"]')).toHaveCount(0);
  await expect(page.getByTestId('connector-spotify')).toHaveCount(0);
  await expect(page.getByTestId('connector-google')).toBeVisible();
});

test('the switch lists them with the badge "In Arbeit" and changes no saved choice', async ({
  page,
}) => {
  await setPreview(page, true);

  await ready(page, '/tools');
  const diff = page.getByTestId('tool-diff');
  await expect(diff).toBeVisible();
  await expect(diff.getByText('In Arbeit', { exact: true })).toBeVisible();
  // Listed, but still off: the switch is a presentation setting.
  await expect(diff.getByLabel('Textvergleich einschalten')).not.toBeChecked();

  await ready(page, '/library');
  const chat = page.getByTestId('module-chat');
  await expect(chat).toBeVisible();
  await expect(chat.getByText('In Arbeit', { exact: true })).toBeVisible();
  await expect(chat.getByText('Aktiv', { exact: true })).toHaveCount(0);

  await ready(page, '/settings/verbindungen');
  await expect(page.locator('section[aria-labelledby="localapi"]')).toBeVisible();
  await expect(page.getByTestId('preview-localapi')).toHaveText('In Arbeit');
  await expect(page.getByTestId('connector-spotify')).toBeVisible();
  await expect(
    page.getByTestId('connector-spotify').getByText('In Arbeit', { exact: true }),
  ).toBeVisible();

  // Off again: everything disappears, nothing was written.
  await setPreview(page, false);
  await ready(page, '/tools');
  await expect(page.getByTestId('tool-diff')).toHaveCount(0);
  const stored = await page.evaluate(() => localStorage.getItem('tm-show-preview'));
  expect(stored).toBeNull();
});

test('a preview tool the user switched on stays reachable with the switch off', async ({
  page,
}) => {
  await setPreview(page, true);
  await ready(page, '/tools');
  await page.getByTestId('tool-diff').getByLabel('Textvergleich einschalten').click();
  await expect(page.getByTestId('tool-diff').getByLabel('Textvergleich einschalten')).toBeChecked();

  await setPreview(page, false);
  await ready(page, '/tools');
  const diff = page.getByTestId('tool-diff');
  await expect(diff).toBeVisible();
  await expect(diff.getByLabel('Textvergleich einschalten')).toBeChecked();
  await expect(diff.getByText('In Arbeit', { exact: true })).toBeVisible();
  // Another preview tool that is off stays hidden.
  await expect(page.getByTestId('tool-regex')).toHaveCount(0);

  await openToolbar(page);
  await toolbar(page).getByRole('button', { name: 'Textvergleich', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Vorher')).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(await paletteOptions(page, 'Textvergleich', 'Werkzeug: Textvergleich')).toHaveCount(
    1,
  );
  await page.keyboard.press('Escape');

  // Turning it off in the library hides it again (no explicit "on" any more).
  await ready(page, '/tools');
  await page.getByTestId('tool-diff').getByLabel('Textvergleich einschalten').click();
  await expect(page.getByTestId('tool-diff')).toHaveCount(0);
});
