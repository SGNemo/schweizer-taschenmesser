import { expect, test, type Page } from '@playwright/test';
import { ready, showAllWidgets } from './helpers';
import { mockWeather } from './weather-mock';

/**
 * Identity v3 overview head (docs/design/MODULE-IDENTITY.md): greeting by the hour, date, calm tools, "Jetzt wichtig" cards
 * without an edge stripe, "Heute · Morgen · diese Woche" as day cards, the widget frame in "Ruhig", reading aid, less motion.
 */
test.beforeEach(async ({ page }) => {
  // Tuesday 2026-09-29, 08:30 local time.
  await page.clock.setFixedTime(new Date('2026-09-29T08:30:00'));
});

async function addTodo(page: Page, title: string, due: string) {
  await ready(page, '/todos');
  await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill(title);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await page.getByLabel('Fällig am').fill(due);
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function addEvent(page: Page, title: string, date: string, time: string) {
  await ready(page, '/calendar?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titel').fill(title);
  await dialog.getByLabel('Datum', { exact: true }).fill(date);
  await dialog.getByLabel('Beginn').fill(time);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.describe('Overview head', () => {
  test('greets by the hour with the date and keeps the page name for screen readers', async ({
    page,
  }) => {
    await ready(page, '/');
    const head = page.getByTestId('overview-head');
    await expect(
      head.getByRole('heading', { level: 1, name: 'Übersicht: Guten Morgen' }),
    ).toBeVisible();
    await expect(head).toContainText('Dienstag, 29. September');

    await page.clock.setFixedTime(new Date('2026-09-29T19:10:00'));
    await page.reload();
    await expect(
      page
        .getByTestId('overview-head')
        .getByRole('heading', { level: 1, name: 'Übersicht: Guten Abend' }),
    ).toBeVisible();
  });

  test('shows a short weather line next to the date once a place is chosen, and none before', async ({
    page,
  }) => {
    // Weather is a preview module: the setting that shows it comes first, as in e2e/weather.spec.ts.
    await showAllWidgets(page);
    await mockWeather(page);
    await ready(page, '/');
    const head = page.getByTestId('overview-head');
    await expect(head).toContainText('Dienstag, 29. September');
    await expect(head.getByRole('link', { name: /^Wetter:/ })).toHaveCount(0);

    await ready(page, '/settings/verbindungen');
    await page.getByLabel('Ort suchen').fill('Bern');
    await page
      .locator('#weather--place')
      .getByRole('button', { name: 'Suchen', exact: true })
      .click();
    await page.getByRole('button', { name: 'Bern, Schweiz wählen' }).click();
    await expect(page.getByTestId('weather-place')).toHaveText('Bern, Schweiz');

    await ready(page, '/');
    const line = page.getByTestId('overview-head').getByRole('link', { name: /^Wetter: 14°/ });
    await expect(line).toBeVisible();
    await expect(line).toHaveAttribute('href', '/weather');
  });

  test('keeps Cockpit, Ruhig/Ausführlich and Anpassen together in the head, inside the window', async ({
    page,
  }) => {
    await ready(page, '/');
    const head = page.getByTestId('overview-head');
    await expect(head.getByTestId('cockpit-enter')).toBeVisible();
    await expect(head.getByRole('group', { name: 'Übersicht' })).toBeVisible();
    await expect(head.getByRole('button', { name: 'Anpassen' })).toBeVisible();
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fits).toBe(true);
  });

  test('"Jetzt wichtig" is a card with the module hue on its plate, the count as figure and no edge stripe', async ({
    page,
  }) => {
    await addTodo(page, 'Müll rausbringen', '2026-09-29');
    await ready(page, '/');
    const card = page
      .getByRole('region', { name: 'Jetzt wichtig' })
      .getByRole('link', { name: /ToDo heute fällig/ });
    await expect(card).toHaveAttribute('data-hue', 'moss');
    const look = await card.evaluate((el) => {
      const s = getComputedStyle(el);
      const plate = el.querySelector('[aria-hidden="true"]')!;
      return {
        left: s.borderLeftWidth,
        right: s.borderRightWidth,
        plate: getComputedStyle(plate).backgroundColor,
        figure: el.querySelector('b')?.textContent,
      };
    });
    expect(look.left).toBe('0px');
    expect(look.right).toBe('0px');
    expect(look.figure).toBe('1');
    expect(look.plate).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('"Heute · Morgen · diese Woche" are day cards side by side on a wide page and stacked on a phone', async ({
    page,
    isMobile,
  }) => {
    await addEvent(page, 'Zahnarzt', '2026-09-29', '14:00');
    await addEvent(page, 'Elternabend', '2026-09-30', '19:00');
    await addEvent(page, 'Chor', '2026-10-02', '18:30');
    await ready(page, '/');
    const [today, tomorrow, week] = await Promise.all(
      ['agenda-today', 'agenda-tomorrow', 'agenda-week'].map((id) =>
        page.getByTestId(id).boundingBox(),
      ),
    );
    if (isMobile) {
      expect(tomorrow!.y).toBeGreaterThanOrEqual(today!.y + today!.height - 1);
      expect(week!.y).toBeGreaterThanOrEqual(tomorrow!.y + tomorrow!.height - 1);
    } else {
      expect(Math.abs(tomorrow!.y - today!.y)).toBeLessThan(2);
      expect(Math.abs(week!.y - today!.y)).toBeLessThan(2);
      expect(tomorrow!.x).toBeGreaterThan(today!.x + today!.width - 1);
      expect(week!.x).toBeGreaterThan(tomorrow!.x + tomorrow!.width - 1);
    }
    // The dot is decoration: the entry reads "14:00 Zahnarzt" without it.
    const entry = page.getByTestId('agenda-today').getByRole('link', { name: /Zahnarzt/ });
    await expect(entry).toHaveAttribute('href', /calendar/);
    await expect(entry.locator('[aria-hidden="true"]')).toHaveCount(1);
  });

  test('the widget frame is tinted and patterned, and "Ruhig" takes the tint down and the pattern away', async ({
    page,
  }) => {
    await ready(page, '/');
    const card = page.getByTestId('widget-todos:next').locator('section').first();
    await expect(card).toBeVisible();
    const pattern = () => card.evaluate((el) => getComputedStyle(el, '::before').opacity);
    expect(Number(await pattern())).toBeGreaterThan(0);

    await page.evaluate(() => {
      document.documentElement.dataset.color = 'calm';
    });
    await expect.poll(pattern).toBe('0');
  });

  test('has no permanent motion, also with less motion asked for', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await addTodo(page, 'Müll rausbringen', '2026-09-29');
    await ready(page, '/');
    await expect(page.getByTestId('overview-head')).toBeVisible();
    const running = await page.evaluate(
      () =>
        document
          .getElementById('main')!
          .getAnimations({ subtree: true })
          .filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity)
          .length,
    );
    expect(running).toBe(0);
  });

  test('reads the same with the reading aid on (desktop shortcut Alt+L)', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'pixel-7', 'the shortcut is a desktop feature');
    await ready(page, '/');
    const h1 = page.getByTestId('overview-head').getByRole('heading', { level: 1 });
    await expect(h1).toHaveText('Übersicht: Guten Morgen');
    await page.keyboard.press('Alt+L');
    await expect(page.getByText('Lesehilfe ist an')).toBeVisible();
    await expect(h1).toHaveText('Übersicht: Guten Morgen');
    await expect(
      page.getByTestId('overview-head').getByRole('heading', { name: 'Übersicht: Guten Morgen' }),
    ).toBeVisible();
  });
});
