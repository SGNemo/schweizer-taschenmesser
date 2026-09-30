import { expect, test, type Page } from '@playwright/test';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

// Invented feed.
const FEED = `<?xml version="1.0"?><rss version="2.0"><channel><title>Beispiel-Nachrichten</title>
<item><guid>a1</guid><title>Neue Brücke eröffnet</title><link>https://news.example.test/bruecke</link><description>Die Brücke ist seit heute offen.</description><pubDate>Tue, 29 Sep 2026 07:00:00 GMT</pubDate></item>
<item><guid>a2</guid><title>Stadtfest lockt viele Gäste</title><link>https://news.example.test/fest</link><description>Bei Sonnenschein kamen tausende.</description><pubDate>Tue, 29 Sep 2026 06:00:00 GMT</pubDate></item>
</channel></rss>`;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, if-none-match, if-modified-since',
  'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
  'access-control-expose-headers': 'etag, last-modified',
};

async function useMockSyncServer(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('_secrets', 'readwrite');
          tx.objectStore('_secrets').put({
            key: 'syncConfig',
            value: {
              kind: 'selfHosted',
              url: 'https://sync.example.test',
              token: 'tok-1234567890abcdef', // gitleaks:allow (invented test value)
            },
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.route('https://sync.example.test/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (request.url().includes('/v1/proxy'))
      return route.fulfill({
        status: 200,
        headers: { ...CORS, 'content-type': 'application/rss+xml; charset=utf-8' },
        body: FEED,
      });
    return route.fulfill({ status: 503, headers: CORS, body: '{}' });
  });
}

async function enableNews(page: Page) {
  await page.goto('/library');
  const card = page.getByTestId('module-news');
  await card.getByRole('button', { name: 'Aktivieren' }).click();
  await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();
  // The library offers the start-data assistant after activation; this test uses the manager instead.
  const wizard = page.getByRole('dialog', { name: /Startdaten/ });
  if (await wizard.isVisible().catch(() => false))
    await wizard.getByRole('button', { name: 'Überspringen' }).click();
}

test('news: add a feed by address, read, filter and mark articles; feed errors are explained', async ({
  page,
}) => {
  await enableNews(page);

  // Without a sync server the browser cannot fetch a feed and says so.
  await page.goto('/news');
  await expect(page.getByText('Noch keine Feeds.')).toBeVisible();
  await page.getByRole('button', { name: 'Feeds verwalten' }).click();
  let manager = page.getByRole('dialog', { name: 'Feeds verwalten' });
  await manager
    .getByLabel('Adresse des Feeds (RSS oder Atom)')
    .fill('https://feeds.example.test/rss.xml');
  await manager.getByRole('button', { name: 'Feed hinzufügen' }).click();
  await expect(manager.getByRole('alert')).toContainText('Sync-Server');
  await page.keyboard.press('Escape');

  await useMockSyncServer(page);
  await page.goto('/news');
  await page.getByRole('button', { name: 'Feeds verwalten' }).click();
  manager = page.getByRole('dialog', { name: 'Feeds verwalten' });
  await manager
    .getByLabel('Adresse des Feeds (RSS oder Atom)')
    .fill('https://feeds.example.test/rss.xml');
  await manager.getByLabel('Thema').selectOption({ label: 'Nachrichten' });
  await manager.getByRole('button', { name: 'Feed hinzufügen' }).click();
  await expect(manager.getByRole('list', { name: 'Deine Feeds' })).toContainText(
    'Beispiel-Nachrichten',
  );
  await manager.getByRole('button', { name: 'Fertig' }).click();

  // Articles are listed, newest first, unread.
  const list = page.getByRole('list', { name: 'Nachrichten' });
  await expect(list.getByRole('button', { name: /Neue Brücke eröffnet/ })).toBeVisible();
  await expect(list.getByRole('button', { name: /Stadtfest/ })).toBeVisible();

  // Search narrows the list.
  await page.getByLabel('Nachrichten durchsuchen').fill('brücke');
  await expect(list.getByRole('button', { name: /Stadtfest/ })).toHaveCount(0);
  await page.getByLabel('Nachrichten durchsuchen').fill('');

  // Marking as read hides it from "Ungelesen" but keeps it under "Alle Artikel".
  await list.getByRole('button', { name: 'Als gelesen markieren' }).first().click();
  await expect(list.getByRole('button', { name: /Neue Brücke eröffnet/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Alle Artikel', exact: true }).click();
  await expect(list.getByRole('button', { name: /Neue Brücke eröffnet/ })).toBeVisible();
  await page.getByRole('button', { name: 'Ungelesen', exact: true }).click();

  // "Für später" explains that the bookmarks module is off.
  await list.getByRole('button', { name: 'Für später' }).first().click();
  await expect(page.getByText(/Die Merkliste ist ausgeschaltet/)).toBeVisible();

  // The dashboard widget lists the unread headline.
  await page.goto('/');
  await expect(page.getByText('Stadtfest lockt viele Gäste')).toBeVisible();

  // Removing the feed removes its articles.
  await page.goto('/news');
  await page.getByRole('button', { name: 'Feeds verwalten' }).click();
  await page
    .getByRole('dialog', { name: 'Feeds verwalten' })
    .getByRole('button', { name: /entfernen/ })
    .click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Noch keine Feeds.')).toBeVisible();
});

test('news: an article goes to the bookmarks when that module is on', async ({ page }) => {
  await enableNews(page);
  await page.goto('/library');
  const bookmarks = page.getByTestId('module-bookmarks');
  await bookmarks.getByRole('button', { name: 'Aktivieren' }).click();
  await expect(bookmarks.getByText('Aktiv', { exact: true })).toBeVisible();
  const wizard = page.getByRole('dialog', { name: /Startdaten/ });
  if (await wizard.isVisible().catch(() => false))
    await wizard.getByRole('button', { name: 'Überspringen' }).click();

  await useMockSyncServer(page);
  await page.goto('/news');
  await page.getByRole('button', { name: 'Feeds verwalten' }).click();
  const manager = page.getByRole('dialog', { name: 'Feeds verwalten' });
  await manager
    .getByLabel('Adresse des Feeds (RSS oder Atom)')
    .fill('https://feeds.example.test/rss.xml');
  await manager.getByRole('button', { name: 'Feed hinzufügen' }).click();
  await manager.getByRole('button', { name: 'Fertig' }).click();

  await page
    .getByRole('list', { name: 'Nachrichten' })
    .getByRole('button', { name: 'Für später' })
    .first()
    .click();
  await expect(page.getByText('Für später gemerkt.')).toBeVisible();
  // The bus handler of the bookmarks module writes asynchronously: wait for its effect.
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const open = indexedDB.open('taschenmesser');
            open.onsuccess = () => {
              const req = open.result
                .transaction('bookmarks_item')
                .objectStore('bookmarks_item')
                .count();
              req.onsuccess = () => resolve(req.result);
            };
          }),
      ),
    )
    .toBe(1);
  await page.goto('/bookmarks');
  await expect(page.getByText('Neue Brücke eröffnet')).toBeVisible();
});
