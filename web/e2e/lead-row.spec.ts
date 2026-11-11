import { expect, test } from '@playwright/test';
import { backSettled, ready } from './helpers';

test.describe('Appointment editor: "Erinnern" row (V05)', () => {
  test('quick choices, calm permission hint, remembered default only preselects', async ({
    page,
  }) => {
    await ready(page, '/calendar?new=1');
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Titel').fill('Zahnarzt');
    // Folded, the reminder is named beside "Mehr Felder"; the row itself is one click away.
    await expect(dialog.getByTestId('more-fields-summary')).toContainText('Ohne Erinnerung');
    await dialog.getByRole('button', { name: 'Mehr Felder anzeigen' }).click();
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

    // Closing the dialog is a pending back traversal; navigating before it settles aborts the load
    // (`net::ERR_ABORTED`) on slow runners.
    await backSettled(page);
    await page.goto('/calendar?new=1');
    // The remembered lead applies while the row is still folded: the summary beside "Mehr Felder" names it.
    await expect(page.getByRole('dialog').getByTestId('more-fields-summary')).toContainText(
      'Erinnerung: 1 Stunde vorher',
    );
    await page.getByRole('dialog').getByRole('button', { name: 'Mehr Felder anzeigen' }).click();
    const again = page.getByRole('dialog').getByRole('group', { name: 'Erinnern' });
    await expect(again.getByRole('button', { name: '1 h' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('dialog').getByRole('button', { name: 'Nicht mehr zeigen' }).click();
    await expect(page.getByTestId('lead-permission-hint')).toHaveCount(0);
  });
});
