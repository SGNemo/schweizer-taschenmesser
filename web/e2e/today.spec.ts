import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function addTodo(page: Page, title: string) {
  await ready(page, '/todos');
  await page.getByLabel('ToDo hinzufügen').fill(title);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
}

async function addEvent(page: Page, title: string, time: string) {
  await ready(page, '/calendar?new=1');
  await page.getByLabel('Titel').fill(title);
  await page.getByLabel('Beginn').fill(time);
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.describe('Heute card (focus audit 2, package 2)', () => {
  test('one card: time to the next appointment, suggestion, appointments; the clock line has a switch', async ({
    page,
  }) => {
    await addTodo(page, 'Formular ausfüllen');
    await addEvent(page, 'Zahnarzt', '11:30');
    await ready(page, '/');
    const card = page.getByTestId('widget-todos:next');
    await expect(card.getByRole('heading', { name: 'Heute', level: 2 })).toBeVisible();
    await expect(card.getByTestId('today-until')).toContainText('in 1 Std 30 Min');
    await expect(card.getByTestId('today-until')).toContainText('11:30 Zahnarzt');
    await expect(card.getByTestId('next-card')).toContainText('Formular ausfüllen');
    await expect(card.getByTestId('today-appointments')).toContainText('Zahnarzt');
    // The three former blocks are not repeated beside it.
    await expect(page.getByTestId('widget-calendar:next')).toHaveCount(0);
    await expect(page.getByTestId('widget-calendar:today')).toHaveCount(0);

    await ready(page, '/settings/darstellung');
    const toggle = page
      .locator('section[aria-labelledby="focus"]')
      .getByRole('switch', { name: 'Zeit bis zum nächsten Termin' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await ready(page, '/');
    await expect(page.getByTestId('today-until')).toHaveCount(0);
    await expect(page.getByTestId('today-appointments')).toContainText('Zahnarzt');
  });

  test('"Anfangen" is the one main button and starts the focus screen; "Später" is quiet', async ({
    page,
  }) => {
    await addTodo(page, 'Wäsche falten');
    await ready(page, '/');
    const card = page.getByTestId('next-card');
    const buttons = card.getByRole('button');
    await expect(buttons).toHaveCount(3);
    await expect(buttons.nth(0)).toContainText('Anfangen');
    await expect(buttons.nth(1)).toHaveText('Später');
    await expect(buttons.nth(2)).toHaveAccessibleName('Weitere Optionen');
    await expect(card.getByRole('button', { name: 'Etwas anderes' })).toHaveCount(0);
    await buttons.nth(0).click();
    await expect(page).toHaveURL(/\/todos\/focus\//);
    await expect(page.getByRole('timer')).toBeVisible();
  });

  test('touch targets on the Heute card and the calm footer are at least 44 px', async ({
    page,
  }) => {
    await addTodo(page, 'Wäsche falten');
    await ready(page, '/');
    await expect(page.getByTestId('next-card')).toBeVisible();
    await expect(page.getByTestId('home-calm-more')).toBeVisible();
    const small = await page
      .locator('[data-testid="widget-todos:next"], [data-testid="home-calm-more"]')
      .locator('button, a[href]')
      .evaluateAll((els) =>
        els
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          // Icon buttons look 40 px and keep a 44 px hit area (ui/Button.module.css).
          .filter(
            ({ el, r }) =>
              r.width > 0 && !el.matches('[class*="_icon_"]') && (r.height < 44 || r.width < 44),
          )
          .map(
            ({ el, r }) =>
              `${el.textContent || el.getAttribute('aria-label')} ${r.width}x${r.height}`,
          ),
      );
    expect(small).toEqual([]);
  });
});

test.describe('Pinning on the home screen', () => {
  test('pin a widget so it stays in the calm view; it survives a reload; unpin takes it out again', async ({
    page,
  }) => {
    await ready(page, '/');
    await expect(page.getByTestId('widget-finance:balance')).toHaveCount(0);
    const more = page.getByTestId('home-calm-more');
    const label = (await more.getByRole('button').first().textContent()) ?? '';
    const count = Number(/(\d+) Widgets/.exec(label)?.[1]);
    expect(count).toBeGreaterThan(1);

    await more.getByRole('button', { name: 'Anheften…' }).click();
    // The existing edit mode, now with a pin per widget.
    await page
      .getByTestId('widget-finance:balance')
      .getByRole('button', { name: 'Kontostand anheften' })
      .click();
    await expect(page.getByTestId('widget-finance:balance')).toContainText('Angeheftet');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.getByTestId('widget-finance:balance')).toBeVisible();
    await expect(page.getByTestId('widget-todos:open')).toHaveCount(0);
    await expect(page.getByTestId('home-calm-more')).toContainText(`${count - 1} Widgets`);

    await page.reload();
    await expect(page.getByTestId('widget-finance:balance')).toBeVisible();

    await page.getByRole('button', { name: 'Anpassen' }).click();
    await page
      .getByTestId('widget-finance:balance')
      .getByRole('button', { name: 'Kontostand lösen' })
      .click();
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.getByTestId('widget-finance:balance')).toHaveCount(0);
    await expect(page.getByTestId('home-calm-more')).toContainText(`${count} Widgets`);
  });

  test('pinning a hidden widget shows it again', async ({ page }) => {
    await ready(page, '/');
    await page.getByRole('button', { name: 'Anpassen' }).click();
    const widget = page.getByTestId('widget-finance:balance');
    await widget.getByRole('button', { name: 'Ausblenden' }).click();
    await expect(widget).toContainText('Ausgeblendet');
    await widget.getByRole('button', { name: 'Kontostand anheften' }).click();
    await expect(widget).not.toContainText('Ausgeblendet');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(widget).toBeVisible();
  });
});
