import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

const html = (page: Page, attr: string) =>
  page.evaluate((a) => document.documentElement.getAttribute(a), attr);

test.describe('Calm display, capture and finding things again', () => {
  test('text size, line spacing and motion are device settings that survive a reload', async ({
    page,
  }) => {
    await ready(page, '/settings/darstellung');
    await page
      .getByRole('group', { name: 'Textgröße' })
      .getByRole('button', { name: 'Sehr groß' })
      .click();
    await page
      .getByRole('group', { name: 'Zeilenabstand' })
      .getByRole('button', { name: 'Luftig' })
      .click();
    await page
      .getByRole('group', { name: 'Bewegung' })
      .getByRole('button', { name: 'Weniger' })
      .click();
    expect(await html(page, 'data-text-size')).toBe('xlarge');
    expect(await html(page, 'data-leading')).toBe('airy');
    expect(await html(page, 'data-motion')).toBe('reduce');

    await page.reload();
    // Applied before the app has started (no flash): the pre-paint script reads the stored choices.
    expect(await html(page, 'data-text-size')).toBe('xlarge');
    expect(await html(page, 'data-leading')).toBe('airy');
    expect(await html(page, 'data-motion')).toBe('reduce');
    const rootSize = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    expect(rootSize).toBe('20px');

    await page
      .getByRole('group', { name: 'Textgröße' })
      .getByRole('button', { name: 'Normal' })
      .click();
    expect(await html(page, 'data-text-size')).toBeNull();
  });

  test('the calm home view shows only what starts the day and can be undone in one tap', async ({
    page,
  }) => {
    await ready(page, '/');
    await expect(page.getByTestId('widget-finance:balance')).toBeVisible();
    await ready(page, '/settings/darstellung');
    await page
      .getByRole('group', { name: 'Übersicht' })
      .getByRole('button', { name: 'Nur das Wichtigste' })
      .click();

    await ready(page, '/');
    await expect(page.getByTestId('widget-todos:next')).toBeVisible();
    await expect(page.getByTestId('widget-calendar:next')).toBeVisible();
    await expect(page.getByTestId('widget-calendar:today')).toBeVisible();
    await expect(page.getByTestId('widget-finance:balance')).toHaveCount(0);
    await expect(page.getByTestId('widget-todos:open')).toHaveCount(0);
    await expect(page.getByTestId('home-calm-note')).toContainText('Ruhige Ansicht');

    await page.getByRole('button', { name: 'Alle Widgets zeigen' }).click();
    await expect(page.getByTestId('widget-finance:balance')).toBeVisible();
    await expect(page.getByTestId('home-calm-note')).toHaveCount(0);
  });

  test('inbox: a vague capture lands in the inbox and is sorted one thing at a time', async ({
    page,
  }) => {
    await ready(page, '/');
    await page.getByRole('button', { name: 'Schnell hinzufügen' }).click();
    const box = page.getByRole('textbox', { name: 'Was möchtest du festhalten?' });
    await box.fill('Irgendwas mit Oma klären');
    // Enter only means something once the module states are loaded: the target chip shows that.
    await expect(page.getByTestId('capture-chips')).toContainText('Ziel: ToDos');
    await box.press('Enter');
    await expect(page.getByText('Gespeichert in ToDos')).toBeVisible();

    await ready(page, '/todos');
    await expect(page.getByTestId('todos-inbox')).toContainText('1 Ding wartet auf einen Platz.');
    await page.getByRole('button', { name: 'Eingang sortieren' }).click();
    const sorter = page.getByTestId('inbox-sorter');
    await expect(sorter).toContainText('Irgendwas mit Oma klären');
    await sorter.getByRole('button', { name: 'Für heute' }).click();
    await expect(page.getByTestId('inbox-sorter-done')).toContainText(
      'Der Eingang ist leer. Gut gemacht.',
    );
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.getByTestId('todos-inbox')).toHaveCount(0);

    await ready(page, '/');
    await expect(page.getByTestId('day-plan')).toContainText('Irgendwas mit Oma klären');
  });

  test('search remembers what was used and shows it first; the history can be deleted', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'pixel-7', 'the palette shortcut is a desktop feature');
    await ready(page, '/');
    await page.keyboard.press('Control+k');
    const box = page.getByRole('combobox');
    await box.fill('einst');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/settings/);

    await ready(page, '/');
    await page.keyboard.press('Control+k');
    const first = page.getByRole('option').first();
    await expect(first).toContainText('Einstellungen');
    await expect(first).toContainText('Zuletzt benutzt');

    await page.keyboard.press('Escape');
    await ready(page, '/settings/darstellung');
    await page.getByRole('button', { name: 'Verlauf löschen' }).click();
    await expect(page.getByText('Verlauf gelöscht.')).toBeVisible();
    await ready(page, '/');
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('option').first()).not.toContainText('Zuletzt benutzt');
  });

  test('has no accessibility violations in the display settings', async ({ page }) => {
    await ready(page, '/settings/darstellung');
    await expect(page.getByRole('group', { name: 'Zeilenabstand' })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
