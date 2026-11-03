import { expect, test } from '@playwright/test';
import { enable, openAppearanceGroup, ready } from './helpers';

test('Erweitert: the rarely needed sections sit behind a fold that is remembered, and a deep link opens it', async ({
  page,
}) => {
  await ready(page, '/settings/ki');
  const fold = page.getByTestId('advanced-fold-ki');
  await expect(fold).toBeVisible();
  await expect(fold).not.toHaveAttribute('open', '');
  // Basis stays outside the fold.
  await expect(page.locator('section[aria-labelledby="ai-switch"]')).toBeVisible();
  await fold.locator('summary').click();
  await expect(fold).toHaveAttribute('open', '');
  await expect(page.locator('section[aria-labelledby="ai-stats"]')).toBeVisible();
  // Remembered per category on this device.
  await ready(page, '/settings/ki');
  await expect(page.getByTestId('advanced-fold-ki')).toHaveAttribute('open', '');
  await page.getByTestId('advanced-fold-ki').locator('summary').click();
  await ready(page, '/settings/ki');
  await expect(page.getByTestId('advanced-fold-ki')).not.toHaveAttribute('open', '');
  // A link into a folded section opens the fold by itself.
  await ready(page, '/settings/ki#ai-stats');
  await expect(page.getByTestId('advanced-fold-ki')).toHaveAttribute('open', '');
  await expect(page.locator('section[aria-labelledby="ai-stats"]')).toBeInViewport();
});

test('a section says where its values live', async ({ page }) => {
  await ready(page, '/settings/darstellung');
  await expect(page.getByTestId('scope-label').first()).toHaveText('Nur auf diesem Gerät');
});

test('the reset row appears only while something differs from the default', async ({ page }) => {
  await ready(page, '/settings/darstellung');
  await expect(page.getByTestId('reset-appearance')).toHaveCount(0);
  await openAppearanceGroup(page, 'theme');
  await page.getByTestId('appearance-group-theme').getByRole('button', { name: 'Dunkel' }).click();
  await expect(page.getByTestId('reset-appearance')).toBeVisible();
  await expect(page.getByText('Vom Standard abweichend').first()).toBeVisible();
  await page.getByTestId('reset-appearance').click();
  await expect(page.getByTestId('reset-appearance')).toHaveCount(0);
});

test('a module setting shows "Geändert · Auf Standard" and goes back with one click, undo included', async ({
  page,
}) => {
  await ready(page, '/settings/module/todos');
  const toggle = page.getByRole('switch', { name: 'Erledigte Aufgaben anzeigen' });
  await expect(toggle).toBeVisible();
  const reset = page.getByTestId('reset-field-module-todos--showDone');
  await expect(reset).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(reset).toBeVisible();
  await expect(page.getByTestId('module-reset-all')).toBeVisible();
  await reset.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(reset).toHaveCount(0);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  // Everything of the module back in one step.
  await page.getByTestId('module-reset-all').click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('module-reset-all')).toHaveCount(0);
});

test('every module setting is explained, also where the module wrote no sentence itself', async ({
  page,
}) => {
  await ready(page, '/settings/module/todos');
  await expect(page.getByText('Zeigt abgehakte Aufgaben weiter in der Liste.')).toBeVisible();
});

test('previews: the reminder sample follows the chosen position', async ({ page }) => {
  await ready(page, '/settings/benachrichtigungen');
  const group = page.getByTestId('calm-reminders-group-inApp');
  await group.locator('summary').click();
  const preview = page.getByTestId('reminder-preview');
  // The sample belongs to the in-app card, which is off by default: no preview until it is on.
  await expect(preview).toHaveCount(0);
  await group
    .getByRole('switch', { name: 'Erinnerungen in der App automatisch einblenden' })
    .click();
  await expect(preview).toBeVisible();
  await expect(preview.locator('[data-position]')).toHaveAttribute('data-position', 'top');
  await group
    .getByRole('group', { name: /Position/ })
    .getByText('Unten')
    .click();
  await expect(preview.locator('[data-position]')).toHaveAttribute('data-position', 'bottom');
});

test('the look preview shows while the colour scheme or text group is open, not at rest', async ({
  page,
}) => {
  await ready(page, '/settings/darstellung');
  await expect(page.getByTestId('look-preview').first()).toBeHidden();
  await openAppearanceGroup(page, 'text');
  await expect(page.getByTestId('appearance-group-text').getByTestId('look-preview')).toBeVisible();
});

test('a weaker vault choice gets a calm note, a stronger one none', async ({ page }) => {
  await enable(page, 'accounts');
  await ready(page, '/settings/sicherheit');
  await page.getByTestId('module-accounts-group-fields').locator('summary').click();
  const lock = page.getByRole('group', { name: 'Tresor sperren nach Inaktivität' });
  await lock.getByRole('button', { name: '30 Minuten' }).click();
  await expect(page.getByTestId('note-autoLockLong')).toBeVisible();
  await lock.getByRole('button', { name: '5 Minuten', exact: true }).click();
  await expect(page.getByTestId('note-autoLockLong')).toHaveCount(0);
});

test('the reset button of a changed field does not take the name of the field input', async ({
  page,
}) => {
  // A spec that finds a field by its label must still find exactly one element after the change.
  await ready(page, '/settings/module/todos');
  await page.getByRole('switch', { name: 'Erledigte Aufgaben anzeigen' }).click();
  await expect(page.getByTestId('reset-field-module-todos--showDone')).toBeVisible();
  await expect(page.getByLabel('Erledigte Aufgaben anzeigen')).toHaveCount(1);
});
