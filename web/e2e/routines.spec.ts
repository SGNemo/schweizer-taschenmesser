import { expect, test } from '@playwright/test';
import { enable, ready } from './helpers';

/**
 * Routinen (UI audit 2026-11, module package H-b): a routine is added with the page's action, a name and Enter;
 * "Erledigt" moves it on to the next name and day and can be taken back; nothing on the page is red or counts days.
 */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

test('a routine: one click, a name, Enter; it is due today', async ({ page }) => {
  await enable(page, 'routines');
  await ready(page, '/routines');
  // Click 1 of at most 2: the page's action (the plus of the bottom bar on the phone).
  const phone = (page.viewportSize()?.width ?? 1280) < 900;
  if (phone) await page.getByTestId('bottom-plus').click();
  else await page.locator('[data-page-action]').click();
  const dialog = page.getByRole('dialog', { name: 'Routine eintragen' });
  await expect(dialog).toBeVisible();
  // The name field has the focus: typing and Enter is all that is left.
  await page.keyboard.type('Bad putzen');
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  const row = page.getByRole('listitem').filter({ hasText: 'Bad putzen' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('dran');
  await expect(page.getByTestId('routines-due')).toContainText('1');
});

test('"Erledigt" hands the routine to the next name, and "Rückgängig" gives it back', async ({
  page,
}) => {
  await enable(page, 'routines');
  await ready(page, '/routines?new=1');
  const dialog = page.getByRole('dialog', { name: 'Routine eintragen' });
  await dialog.getByLabel('Was').fill('Müll rausbringen');
  await dialog.getByRole('button', { name: 'Mehr Felder anzeigen' }).click();
  await dialog.getByLabel('Wer wechselt sich ab').fill('Mia, Ben');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toHaveCount(0);

  const row = page.getByRole('listitem').filter({ hasText: 'Müll rausbringen' });
  await expect(row).toContainText('an der Reihe: Mia');
  await row.getByRole('button', { name: 'Erledigt: Müll rausbringen' }).click();
  await expect(page.getByText('Müll rausbringen erledigt. Als Nächstes: Ben.')).toBeVisible();
  // Nothing is due any more; the routine waits under "Alle nach Raum" with the next name.
  await expect(page.getByTestId('routines-nothing-due')).toBeVisible();
  await page.getByRole('button', { name: 'Alle nach Raum' }).click();
  await expect(row).toContainText('an der Reihe: Ben');
  await expect(row).toContainText('Di., 6. Okt.');

  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(row).toContainText('an der Reihe: Mia');
  await page.getByRole('button', { name: 'Dran', exact: true }).click();
  await expect(row).toContainText('dran');
});

test('calm: no red on the page, and a routine that waited is simply "dran"', async ({ page }) => {
  await enable(page, 'routines');
  await ready(page, '/routines?new=1');
  const dialog = page.getByRole('dialog', { name: 'Routine eintragen' });
  await dialog.getByLabel('Was').fill('Fenster putzen');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toHaveCount(0);
  // Three weeks later the routine was never ticked: it is "dran", nothing more.
  await page.clock.setFixedTime(new Date('2026-10-20T10:00:00'));
  await ready(page, '/routines');
  const row = page.getByRole('listitem').filter({ hasText: 'Fenster putzen' });
  await expect(row).toContainText('dran');
  await expect(page.locator('main')).not.toContainText(/überfällig|verpasst|seit \d+ Tagen/i);
  const red = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--danger)';
    document.body.append(probe);
    const danger = getComputedStyle(probe).color;
    probe.remove();
    return [...document.querySelectorAll('main *')].filter((el) => {
      const s = getComputedStyle(el);
      return s.color === danger || s.backgroundColor === danger;
    }).length;
  });
  expect(red).toBe(0);
});
