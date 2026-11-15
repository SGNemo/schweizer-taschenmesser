import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ready, showPreview } from './helpers';
import { defaultBrowse, mockSpotify, seedConnected, type Mock } from './spotify-mock';

// Preview modules are listed only with "In Arbeit anzeigen" (maturity).
test.beforeEach(({ page }) => showPreview(page));

/**
 * The playlists tab against a mocked Web API (invented names): every playlist, search, own vs. followed, a new playlist,
 * rename, and removing a song with "Rückgängig". The shared mock stays as it is; this spec only adds its answers.
 */
const ALL = ['show', 'control', 'playlists', 'playlistEdit'];
const ME = 'me1';
const song = (id: string, name: string) => ({
  id,
  name,
  type: 'track',
  duration_ms: 200_000,
  artists: [{ name: 'Erfundene Band' }],
  album: { name: 'Erfundenes Album' },
});

function library(mock: Mock) {
  mock.playlists = () => ({
    status: 200,
    body: {
      items: [
        { id: 'pl1ABC', name: 'Tiefer Fokus', owner: { id: ME }, tracks: { total: 3 } },
        {
          id: 'pl2DEF',
          name: 'Roadtrip',
          owner: { id: 'kim', display_name: 'Kim' },
          tracks: { total: 20 },
        },
        { id: 'pl3GHI', name: 'Abendruhe', owner: { id: ME }, tracks: { total: 8 } },
      ],
    },
  });
  mock.browse = (method, pathname, search) => {
    if (pathname === '/v1/me' && method === 'GET') return { status: 200, body: { id: ME } };
    if (pathname === '/v1/me/playlists' && method === 'POST')
      return { status: 201, body: { id: 'pl9NEW', name: 'Neu' } };
    if (pathname === '/v1/playlists/pl1ABC' && method === 'GET')
      return {
        status: 200,
        body: {
          name: 'Tiefer Fokus',
          description: 'Ohne Worte &amp; leise',
          owner: { id: ME, display_name: 'Ich' },
          tracks: {
            total: 3,
            items: [
              { track: song('sg1AAA', 'Erstes Lied') },
              { track: song('sg2BBB', 'Zweites Lied') },
              { track: song('sg3CCC', 'Drittes Lied') },
            ],
          },
        },
      };
    if (/^\/v1\/playlists\/pl1ABC(\/items)?$/.test(pathname) && method !== 'GET')
      return { status: 200, body: { snapshot_id: 'x' } };
    return defaultBrowse(method, pathname, search);
  };
}

async function openTab(page: Page) {
  await ready(page, '/music');
  await page
    .getByRole('navigation', { name: 'Ansichten' })
    .getByRole('button', { name: 'Playlists' })
    .click();
  const lib = page.getByTestId('music-lib');
  await expect(lib).toBeVisible();
  return lib;
}

test.describe('Music playlists tab', () => {
  test('lists, searches and filters playlists; a tile opens the playlist and leads back', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    library(mock);
    await seedConnected(page, ALL);
    const lib = await openTab(page);
    await expect(lib).toContainText('3 Playlists');
    await expect(lib).toContainText('20 Titel · von Kim');
    // WCAG 2.2 AA on the tab with its tiles, search, filter and sort (both themes are covered by a11y.spec for the frame).
    const axe = await new AxeBuilder({ page })
      .include('[data-testid="music-lib"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    await lib.getByRole('searchbox', { name: 'Playlists durchsuchen' }).fill('ruhe');
    await expect(lib.getByTestId('music-tile-title')).toHaveText(['Abendruhe']);
    await lib.getByRole('searchbox', { name: 'Playlists durchsuchen' }).fill('');
    await lib
      .getByRole('group', { name: 'Welche Playlists' })
      .getByRole('button', { name: 'Gefolgte' })
      .click();
    await expect(lib.getByTestId('music-tile-title')).toHaveText(['Roadtrip']);
    await lib
      .getByRole('group', { name: 'Welche Playlists' })
      .getByRole('button', { name: 'Alle' })
      .click();
    await lib.getByRole('button', { name: /^Tiefer Fokus/ }).click();
    const main = page.getByTestId('music-main');
    await expect(main.getByTestId('music-list-about')).toHaveText('Ohne Worte & leise');
    await main.getByRole('button', { name: 'Zurück zu den Playlists' }).click();
    await expect(page.getByTestId('music-lib')).toBeVisible();
  });

  test('renames an own playlist and removes a song with "Rückgängig"', async ({ page }) => {
    const mock = await mockSpotify(page);
    library(mock);
    await seedConnected(page, ALL);
    const lib = await openTab(page);
    await lib.getByRole('button', { name: /^Tiefer Fokus/ }).click();
    const main = page.getByTestId('music-main');
    await main.getByRole('button', { name: '„Tiefer Fokus“ bearbeiten' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Tiefe Arbeit');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(main.getByRole('heading', { name: 'Tiefe Arbeit' })).toBeVisible();
    expect(mock.api).toContain('PUT /v1/playlists/pl1ABC {"name":"Tiefe Arbeit"}');

    await main.getByRole('button', { name: 'Mehr zu Zweites Lied' }).click();
    await page.getByRole('menuitem', { name: 'Aus dieser Playlist entfernen' }).click();
    await expect(main.getByTestId('track-row')).toHaveCount(2);
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(main.getByTestId('track-row')).toHaveCount(3);
    await expect
      .poll(() => mock.api.find((c) => c.startsWith('POST /v1/playlists/pl1ABC/items')))
      .toBe('POST /v1/playlists/pl1ABC/items {"uris":["spotify:track:sg2BBB"],"position":1}');
  });

  test('"Neue Playlist" creates a private playlist', async ({ page }) => {
    const mock = await mockSpotify(page);
    library(mock);
    await seedConnected(page, ALL);
    const lib = await openTab(page);
    await lib.getByRole('button', { name: 'Neue Playlist' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Neu');
    await dialog.getByRole('button', { name: 'Anlegen' }).click();
    await expect.poll(() => mock.api.some((c) => c.startsWith('POST /v1/me/playlists'))).toBe(true);
    expect(mock.api.find((c) => c.startsWith('POST /v1/me/playlists'))).toBe(
      'POST /v1/me/playlists {"name":"Neu","public":false}',
    );
  });
});
