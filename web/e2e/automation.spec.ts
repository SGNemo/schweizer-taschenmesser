import { expect, test } from '@playwright/test';
import { enable, ready, showPreview } from './helpers';

const isPhone = (info: { project: { name: string } }) => info.project.name === 'pixel-7';

test.describe('Automatisierungen', () => {
  test('are hidden until "In Arbeit anzeigen", off by default, and a template switches on', async ({
    page,
  }) => {
    await ready(page, '/settings/benachrichtigungen');
    await expect(page.locator('section[aria-labelledby="automation"]')).toHaveCount(0);

    await showPreview(page);
    const section = page.locator('section[aria-labelledby="automation"]');
    const master = section.getByRole('switch', { name: 'Automatisierungen verwenden' });
    await expect(master).toHaveAttribute('aria-checked', 'false');
    // nothing else is offered while the master switch is off
    await expect(section.getByText('Vorlagen')).toHaveCount(0);

    await master.click();
    await expect(master).toHaveAttribute('aria-checked', 'true');
    const rule = section.getByRole('switch', { name: 'Rechnung bald fällig einschalten' });
    await expect(rule).toHaveAttribute('aria-checked', 'false'); // every template starts off
    await rule.click();
    await expect(rule).toHaveAttribute('aria-checked', 'true');
    // its parameter appears
    await expect(section.getByLabel('Tage vorher').first()).toBeVisible();

    // the log starts empty and nothing was written
    const log = page.locator('section[aria-labelledby="automation-log"]');
    await expect(log.getByTestId('automation-log-empty')).toBeVisible();
  });

  test('the palette lists the rules only once switched on, and opens the log', async ({
    page,
  }, info) => {
    test.skip(isPhone(info), 'the palette is a desktop shortcut');
    await ready(page, '/settings/benachrichtigungen');
    await showPreview(page);
    const section = page.locator('section[aria-labelledby="automation"]');
    await section.getByRole('switch', { name: 'Automatisierungen verwenden' }).click();
    await section.getByRole('switch', { name: 'Wochenrückblick einschalten' }).click();
    await enable(page, 'todos');

    await page.keyboard.press('Control+k');
    const box = page.getByRole('combobox', { name: /Suchen, springen/ });
    await box.fill('regel');
    await expect(
      page.getByRole('option', { name: /Regel ausführen: Wochenrückblick/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('option', { name: /Letzte Regel-Ausführung rückgängig/ }),
    ).toBeVisible();
    await page.getByRole('option', { name: /Regel-Protokoll öffnen/ }).click();
    await expect(page).toHaveURL(/benachrichtigungen#automation-log/);
  });
});
