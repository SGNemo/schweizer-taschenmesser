import { expect, test } from '@playwright/test';
import { ready } from './helpers';

test.describe('Appointment editor: "Erinnern" row (V05)', () => {
  test('quick choices, calm permission hint, remembered default only preselects', async ({
    page,
  }) => {
    await ready(page, '/calendar?new=1');
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Titel').fill('Zahnarzt');
    const row = dialog.getByRole('group', { name: 'Erinnern' });
    await expect(row.getByRole('button', { name: 'Keine' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await row.getByRole('button', { name: '1 h' }).click();
    await expect(row.getByRole('button', { name: '1 h' })).toHaveAttribute('aria-pressed', 'true');

    // No permission in the test browser: one calm sentence, switchable off, never a blocker.
    await expect(dialog.getByTestId('lead-permission-hint')).toBeVisible();
    await dialog.getByLabel('Als Vorgabe merken').click();
    await expect(dialog.getByLabel('Als Vorgabe merken')).toBeChecked();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.goto('/calendar?new=1');
    const again = page.getByRole('dialog').getByRole('group', { name: 'Erinnern' });
    await expect(again.getByRole('button', { name: '1 h' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('dialog').getByRole('button', { name: 'Nicht mehr zeigen' }).click();
    await expect(page.getByTestId('lead-permission-hint')).toHaveCount(0);
  });
});
