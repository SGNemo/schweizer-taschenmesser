import { expect, test, type Page } from '@playwright/test';
import { enable, ready } from './helpers';

/** QA package P2: nothing is cut off or covered on a phone; one tick area per list row; one notice at a time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

const WIDTHS = [320, 412, 640];

async function noSideScroll(page: Page) {
  const extra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(extra).toBeLessThanOrEqual(0);
}

async function inViewport(page: Page, name: string, role: 'button' | 'link' = 'button') {
  const box = await page.getByRole(role, { name }).first().boundingBox();
  const width = page.viewportSize()!.width;
  expect(box, name).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 0.5);
}

for (const width of WIDTHS) {
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('top bar: search keeps a 44 px target, bell and tools stay inside the bar', async ({
      page,
    }) => {
      await ready(page, '/');
      const search = page.getByRole('button', { name: /Suche/ }).first();
      const box = (await search.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await inViewport(page, 'Werkzeuge');
      await noSideScroll(page);
    });

    test('calendar: the Kalender | Erinnerungen switch is complete', async ({ page }) => {
      await ready(page, '/calendar');
      await inViewport(page, 'Erinnerungen');
      const group = page.getByRole('group', { name: /Kalender|Ansicht/ }).first();
      const metrics = await group.evaluate((el) => ({
        scroll: el.scrollWidth,
        client: el.clientWidth,
      }));
      expect(metrics.scroll).toBeLessThanOrEqual(metrics.client);
      await noSideScroll(page);
    });

    test('welcome card: text and both buttons are readable and reachable', async ({ page }) => {
      await ready(page, '/');
      const card = page.getByTestId('setup-welcome');
      await expect(card).toBeVisible();
      for (const name of ['Einrichtung starten', 'Später']) {
        const button = card.getByRole('button', { name });
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeVisible();
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      // No paragraph in the card is clipped (a clamped block has scrollHeight > clientHeight).
      const clipped = await card.evaluate(
        (el) =>
          [...el.querySelectorAll('p')].filter((p) => p.scrollHeight > p.clientHeight + 1).length,
      );
      expect(clipped).toBe(0);
      await noSideScroll(page);
    });
  });
}

test.describe('shopping list on a phone', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  async function addItems(page: Page, names: string[]) {
    await enable(page, 'lists');
    await ready(page, '/lists');
    const input = page.getByLabel('Eintrag hinzufügen');
    for (const name of names) {
      await input.fill(name);
      await input.press('Enter');
      await expect(page.getByRole('checkbox', { name })).toBeVisible();
    }
  }

  test('one tick box per row; the whole row ticks, stays in place, and the notice names it', async ({
    page,
  }) => {
    await addItems(page, ['Milch', 'Brot', 'Eier']);
    const rows = page.getByRole('list', { name: 'Einkauf' }).getByRole('listitem');
    await expect(rows).toHaveCount(3);
    for (const row of await rows.all()) await expect(row.getByRole('checkbox')).toHaveCount(1);

    // Tapping the text (not the box) ticks the entry; it keeps its place for a moment.
    await rows.nth(0).getByRole('button', { name: 'Milch' }).click();
    await expect(page.getByRole('checkbox', { name: 'Milch' })).toBeChecked();
    await expect(page.getByText('„Milch“ abgehakt.')).toBeVisible();
    await expect(rows.nth(0)).toContainText('Milch');
    // ... and moves down once the hold is over.
    await expect(rows.nth(2)).toContainText('Milch', { timeout: 8000 });
  });

  test('the hold can be undone from the notice, one notice at a time', async ({ page }) => {
    await addItems(page, ['Milch', 'Brot']);
    const rows = page.getByRole('list', { name: 'Einkauf' }).getByRole('listitem');
    await rows.nth(0).getByRole('button', { name: 'Milch' }).click();
    await rows.nth(1).getByRole('button', { name: 'Brot' }).click();
    await expect(page.getByText('„Brot“ abgehakt.')).toBeVisible();
    await expect(page.getByRole('status').getByText(/abgehakt/)).toHaveCount(1);
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(page.getByRole('checkbox', { name: 'Brot' })).not.toBeChecked();
  });

  test('a long entry wraps in full and the row has no second box', async ({ page }) => {
    const long = 'Haferflocken kernig, glutenfrei, ohne Zuckerzusatz, aus kontrolliertem Anbau';
    await addItems(page, [long]);
    const row = page.getByRole('list', { name: 'Einkauf' }).getByRole('listitem').first();
    const text = row.getByRole('button', { name: /Haferflocken/ });
    await expect(text).toBeVisible();
    const clipped = await text.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(clipped).toBe(false);
    await noSideScroll(page);
  });

  test('a wide trailing value never squeezes the text to a sliver', async ({ page }) => {
    await addItems(page, ['Haferflocken']);
    const row = page.getByRole('list', { name: 'Einkauf' }).getByRole('listitem').first();
    await row.getByRole('button', { name: 'Eintrag bearbeiten' }).click();
    await page.getByLabel('Menge (optional)').fill('12 große Packungen aus dem Großhandel');
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
    const main = row.getByRole('button', { name: /Haferflocken/ });
    await expect(row.getByText(/Großhandel/)).toBeVisible();
    expect((await main.boundingBox())!.width).toBeGreaterThanOrEqual(140);
    await noSideScroll(page);
  });

  test('the "+" button leaves room: the last row can be scrolled above it', async ({ page }) => {
    await addItems(page, ['Milch']);
    const fab = page.getByRole('button', { name: 'Schnell hinzufügen' });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = (await page.getByRole('main').locator('li').last().boundingBox())!;
    const fabBox = (await fab.boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(fabBox.y);
  });
});

test.describe('top bar with a running focus round', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('search stays a 44 px target and nothing is pushed out of the bar', async ({ page }) => {
    await ready(page, '/todos');
    await page.getByLabel('ToDo hinzufügen').fill('Keller aufräumen');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    await expect(page.getByText('Keller aufräumen').first()).toBeVisible();
    await ready(page, '/');
    await page
      .getByTestId('next-card')
      .getByRole('button', { name: /Anfangen/ })
      .click();
    await page.getByRole('button', { name: 'Verlassen' }).click();
    await expect(page.getByTestId('focus-indicator')).toBeVisible();
    const box = (await page.getByRole('button', { name: 'Suchen' }).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    await inViewport(page, 'Werkzeuge');
    await noSideScroll(page);
  });
});

test.describe('ToDos on a wide screen', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the list uses the page width, not a 240 px rail column', async ({ page }) => {
    await ready(page, '/todos');
    await page.getByLabel('ToDo hinzufügen').fill('Ein recht langer Titel für eine Aufgabe');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    const title = page.getByText('Ein recht langer Titel für eine Aufgabe').first();
    await expect(title).toBeVisible();
    const box = (await page.getByLabel('ToDo hinzufügen').boundingBox())!;
    expect(box.width).toBeGreaterThan(500);
    expect((await title.boundingBox())!.height).toBeLessThan(40); // one line, not letter by letter
  });
});

test.describe('Settings navigation on a wide screen', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('a category title and its status never overlap', async ({ page }) => {
    await ready(page, '/settings/benachrichtigungen');
    // The title is one long word that overflows its (shrunk) box, so compare the text itself.
    const overlaps = await page.getByTestId('settings-nav').evaluate(
      (nav) =>
        [...nav.querySelectorAll('a')].filter((a) => {
          const title = a.querySelector('[class*="linkTitle"]');
          const status = a.querySelector('[class*="status"]');
          if (!title || !status) return false;
          const range = document.createRange();
          range.selectNodeContents(title);
          const x = range.getBoundingClientRect();
          const y = status.getBoundingClientRect();
          return x.right > y.left && x.left < y.right && x.bottom > y.top && x.top < y.bottom;
        }).length,
    );
    expect(overlaps).toBe(0);
  });
});
