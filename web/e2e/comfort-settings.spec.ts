import { expect, test } from '@playwright/test';
import { enableExample, ready, showAllWidgets, openAppearanceGroup } from './helpers';

const isPhone = (info: { project: { name: string } }) => info.project.name === 'pixel-7';

test('quick bar: theme in one click from the settings start, no category needed', async ({
  page,
}, info) => {
  await ready(page, '/settings');
  const bar = page.getByTestId('quick-bar');
  await expect(bar).toBeVisible();
  // Click 1 of 1 (after opening Settings): the theme switches and a toast offers to undo it.
  await bar.getByRole('button', { name: 'Dunkel' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  void info;
});

test('palette: "dunkel" switches the theme without leaving the page', async ({ page }, info) => {
  test.skip(isPhone(info), 'keyboard shortcut');
  await ready(page, '/settings/darstellung');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: /Suchen, springen/ }).fill('dunkel');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page).toHaveURL(/\/settings\/darstellung$/);
});

test('palette finds a setting by an everyday word and opens its row', async ({ page }, info) => {
  test.skip(isPhone(info), 'keyboard shortcut');
  await ready(page, '/');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: /Suchen, springen/ }).fill('nicht stören');
  await page
    .getByRole('option', { name: /Ruhige Erinnerungen/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/settings\/benachrichtigungen#calm-reminders/);
});

test('context gear: from a widget straight to the module settings, section highlighted', async ({
  page,
}) => {
  await showAllWidgets(page);
  await enableExample(page);
  await ready(page, '/');
  const widget = page.locator('[data-testid^="widget-example:"]').first();
  await widget.hover();
  await widget.getByTestId('settings-link').click();
  await expect(page).toHaveURL(/\/settings\/module#module-example$/);
  await expect(page.locator('section[aria-labelledby="module-example"]')).toHaveAttribute(
    'data-highlight',
    'true',
  );
});

test('reset a section: back to the default, undo brings the value back', async ({ page }) => {
  await ready(page, '/settings/darstellung');
  await openAppearanceGroup(page, 'text');
  await page
    .locator('section[aria-labelledby="appearance"]')
    .getByRole('group', { name: 'Dichte' })
    .getByRole('button', { name: 'Kompakt' })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await page.getByTestId('reset-appearance').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-density', 'compact');
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
});

test('phone: the search stays within reach inside a category', async ({ page }, info) => {
  test.skip(!isPhone(info), 'phone layout');
  await ready(page, '/settings/darstellung');
  const search = page.getByRole('searchbox', { name: 'Einstellungen durchsuchen' });
  await expect(search).toBeVisible();
  await page.mouse.wheel(0, 1500);
  await expect(search).toBeInViewport();
});

test('frequently used: a section opened twice is offered at the top of the list', async ({
  page,
}) => {
  for (let i = 0; i < 2; i++) {
    await ready(page, '/settings/sync#backup');
    // The visit counts once the section is on screen and marked.
    await expect(page.locator('section[aria-labelledby="backup"]')).toHaveAttribute(
      'data-highlight',
      'true',
    );
    await ready(page, '/settings/ki');
  }
  await ready(page, '/settings');
  await expect(page.getByRole('navigation', { name: 'Häufig genutzt' })).toBeVisible();
});

test('library card and deep link: /library#module-… marks the card', async ({ page }) => {
  await ready(page, '/library#module-todos');
  await expect(page.locator('#module-todos')).toHaveAttribute('data-hash-target', 'true');
});

test('mute: one tap starts a pause, it shows when it ends, one tap ends it', async ({ page }) => {
  await ready(page, '/settings');
  const bar = page.getByTestId('quick-bar');
  await bar.getByRole('group', { name: 'Stumm' }).getByRole('button', { name: '1 Stunde' }).click();
  await expect(bar.getByText(/^Stumm bis /)).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tm-mute'))).toContain('"1h"');
  await bar.getByRole('group', { name: 'Stumm' }).getByRole('button', { name: 'Aus' }).click();
  await expect(bar.getByText(/^Stumm bis /)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tm-mute'))).toBeNull();
});

test('mute: reachable from the palette', async ({ page }, info) => {
  test.skip(isPhone(info), 'keyboard shortcut');
  await ready(page, '/');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: /Suchen, springen/ }).fill('Stumm: bis morgen');
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('tm-mute')))
    .toContain('tomorrow');
});

test('appearance: a group shows the current choice, "Ändern" opens the picker, the theme switches', async ({
  page,
}) => {
  await ready(page, '/settings/darstellung');
  const group = page.getByTestId('appearance-group-theme');
  await expect(group.locator('summary')).toContainText('Thema: System');
  await expect(group.locator('summary')).toContainText('Ändern');
  await expect(group.locator('summary')).toHaveAttribute('aria-expanded', 'false');
  await expect(group.getByRole('group', { name: 'Farbschema' })).toBeHidden();
  await group.locator('summary').click();
  await expect(group.locator('summary')).toHaveAttribute('aria-expanded', 'true');
  await group
    .getByRole('group', { name: 'Farbschema' })
    .getByRole('button', { name: 'Dunkel' })
    .click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(group.locator('summary')).toContainText('Thema: Dunkel');
  await expect(group.locator('summary')).toContainText('Fertig');
});

test('appearance: the group opens from the keyboard', async ({ page }, info) => {
  test.skip(isPhone(info), 'keyboard');
  await ready(page, '/settings/darstellung');
  const group = page.getByTestId('appearance-group-motion');
  await group.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(group.locator('summary')).toHaveAttribute('aria-expanded', 'true');
  await expect(group.getByRole('group', { name: 'Bewegung' })).toBeVisible();
});

test('appearance: a deep link into a folded field opens its group and lands on the row', async ({
  page,
}) => {
  await ready(page, '/settings/darstellung#appearance--density');
  await expect(page.getByTestId('appearance-group-text')).toHaveAttribute('open', '');
  await expect(page.locator('#appearance--density')).toBeInViewport();
  await expect(page.locator('#appearance--density')).toHaveAttribute('data-highlight', 'true');
  await expect(page.getByTestId('appearance-group-theme')).not.toHaveAttribute('open', '');
});

test('module settings: a deep link into a folded field opens the module group and lands on the row', async ({
  page,
}) => {
  await enableExample(page);
  await ready(page, '/settings/module#module-example--showDone');
  await expect(page.getByTestId('module-example-group-fields')).toHaveAttribute('open', '');
  await expect(page.locator('#module-example--showDone')).toBeInViewport();
  await expect(page.locator('#module-example--showDone')).toHaveAttribute('data-highlight', 'true');
});
