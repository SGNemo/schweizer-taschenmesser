import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ready, showPreview } from './helpers';
import { defaultBrowse, mockSpotify, seedConnected } from './spotify-mock';

// Preview modules are listed only with "In Arbeit anzeigen" (maturity).
test.beforeEach(({ page }) => showPreview(page));

/** Albums tab, artist page and "Weiterhören" against a mocked Web API (invented names); the shared mock stays as it is. */
const ALL = ['show', 'control', 'playlists', 'library', 'history'];
const song = (id: string, name: string) => ({
  id,
  name,
  type: 'track',
  duration_ms: 200_000,
  artists: [{ name: 'Erfundene Band', id: 'ar1AAA' }],
  album: { id: 'al1AAA', name: 'Erstes Album' },
});
const album = (id: string, name: string) => ({
  id,
  name,
  album_type: 'album',
  artists: [{ name: 'Erfundene Band', id: 'ar1AAA' }],
});

test('albums tab, album heart, artist page and "Weiterhören"', async ({ page }) => {
  const mock = await mockSpotify(page);
  mock.browse = (method, pathname, search) => {
    if (pathname === '/v1/me/albums/contains') return { status: 200, body: [false] };
    if (pathname === '/v1/me/albums' && method === 'GET')
      return { status: 200, body: { items: [{ album: album('al1AAA', 'Erstes Album') }] } };
    if (pathname === '/v1/me/albums') return { status: 200 };
    if (pathname === '/v1/albums/al1AAA')
      return {
        status: 200,
        body: {
          ...album('al1AAA', 'Erstes Album'),
          tracks: { items: [song('a1AAA', 'Albumlied')] },
        },
      };
    if (pathname === '/v1/artists/ar1AAA') return { status: 200, body: { name: 'Erfundene Band' } };
    if (pathname === '/v1/artists/ar1AAA/top-tracks')
      return { status: 200, body: { tracks: [song('h1AAA', 'Hit')] } };
    if (pathname === '/v1/artists/ar1AAA/albums')
      return { status: 200, body: { items: [album('al1AAA', 'Erstes Album')] } };
    if (pathname === '/v1/me/player/recently-played')
      return {
        status: 200,
        body: {
          items: [
            {
              track: song('r1AAA', 'Gestern'),
              context: { type: 'album', uri: 'spotify:album:al1AAA' },
            },
          ],
        },
      };
    return defaultBrowse(method, pathname, search);
  };
  await seedConnected(page, ALL);
  await ready(page, '/music');
  await expect(page.getByTestId('music-continue')).toContainText('Erstes Album');

  await page
    .getByRole('navigation', { name: 'Ansichten' })
    .getByRole('button', { name: 'Alben' })
    .click();
  const tab = page.getByTestId('music-albums');
  await expect(tab).toContainText('1 Album');
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="music-albums"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await tab.getByRole('button', { name: /^Erstes Album/ }).click();
  const main = page.getByTestId('music-main');
  await main.getByTestId('music-album-save').click();
  await expect.poll(() => mock.api.some((c) => c.startsWith('PUT /v1/me/albums'))).toBe(true);
  await main.getByRole('button', { name: 'Künstler: Erfundene Band' }).click();
  await expect(main.getByRole('button', { name: 'Hit abspielen' })).toBeVisible();
  await expect(main.getByTestId('music-artist-albums')).toContainText('Erstes Album');
});
