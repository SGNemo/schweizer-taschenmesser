import { expect, test, type Page } from '@playwright/test';
import { ready, showPreview } from './helpers';
import {
  COVER,
  albumImages,
  defaultBrowse,
  mockSpotify,
  mosaicImages,
  seedConnected,
  type Mock,
} from './spotify-mock';

// Preview modules, tools, connectors and sections are listed only with "In Arbeit anzeigen" (maturity).
test.beforeEach(({ page }) => showPreview(page));

/**
 * The music page against a mocked Web API: open a playlist and see every song, play one inside its playlist, save a song with
 * the heart, hide one, queue one, switch the device. A full page in the module frame, not a dialog.
 */
const ALL = ['show', 'control', 'playlists', 'library', 'history'];

async function openMusic(page: Page) {
  await ready(page, '/music');
  await expect(page.getByTestId('music-now')).toBeVisible();
  return page.getByTestId('music-main');
}
/** The view chips of the toolbar (the only way into the lists; the aside holds the queue). */
const chip = (page: Page, name: RegExp | string) =>
  page.getByRole('navigation', { name: 'Ansichten' }).getByRole('button', { name });

/** Playlists and songs with pictures in every shape the service uses, plus one from a host that is not Spotify's. */
function withCovers(mock: Mock) {
  mock.playlists = () => ({
    status: 200,
    body: {
      items: [
        { id: 'pl1ABC', name: 'Tiefer Fokus', images: mosaicImages('fokus') },
        { id: 'pl2DEF', name: 'Ruhe', images: [{ url: COVER.uploaded('ruhe'), width: null }] },
        { id: 'pl3GHI', name: 'Abend', images: [{ url: COVER.uploaded('abend', 'fa') }] },
        { id: 'pl4JKL', name: 'Fremdes Bild', images: [{ url: COVER.foreign, width: 300 }] },
        { id: 'pl5MNO', name: 'Leer', images: [] },
      ],
    },
  });
  const song = (id: string, name: string, album: string) => ({
    id,
    name,
    type: 'track',
    duration_ms: 200_000,
    artists: [{ name: 'Erfundene Band' }],
    album: { name: album, images: albumImages(album) },
  });
  mock.browse = (method, pathname, search) => {
    if (pathname === '/v1/playlists/pl1ABC' && method === 'GET')
      return {
        status: 200,
        body: {
          name: 'Tiefer Fokus',
          owner: { display_name: 'Ich' },
          images: mosaicImages('fokus'),
          tracks: {
            total: 3,
            items: [
              { track: song('sg1AAA', 'Erstes Lied', 'Album Eins') },
              { track: song('sg2BBB', 'Zweites Lied', 'Album Eins') },
              { track: song('sg3CCC', 'Drittes Lied', 'Album Zwei') },
            ],
          },
        },
      };
    if (pathname === '/v1/me/player/recently-played')
      return {
        status: 200,
        body: { items: [{ track: song('rc1AAA', 'Gestern gehört', 'Album Gestern') }] },
      };
    if (pathname === '/v1/me/player/queue' && method === 'GET')
      return {
        status: 200,
        body: {
          currently_playing: song('cur111', 'Testlied', 'Album Jetzt'),
          queue: [song('qu1AAA', 'Als Nächstes', 'Album Zwei')],
        },
      };
    return defaultBrowse(method, pathname, search);
  };
  mock.player = () => ({
    status: 200,
    body: {
      is_playing: true,
      currently_playing_type: 'track',
      item: {
        name: 'Testlied',
        artists: [{ name: 'Erfundene Band' }],
        album: { name: 'Album Jetzt', images: albumImages('Album Jetzt') },
        external_urls: { spotify: 'https://open.spotify.com/track/abc123' },
      },
    },
  });
}
const host = (url: string) => new URL(url).host;

test.describe('Music covers', () => {
  test('tiles show the mosaic and the uploaded pictures; a foreign host is never asked', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    withCovers(mock);
    await seedConnected(page, ALL);
    await openMusic(page);
    const grid = page.getByTestId('music-playlists');
    // Pictures load when their tile comes into view, so the test looks at each one.
    for (const name of ['Tiefer Fokus', 'Ruhe', 'Abend']) {
      await grid.getByRole('button', { name }).scrollIntoViewIfNeeded();
      const img = grid.getByRole('img', { name });
      await expect(img).toBeVisible();
      await expect(img).toHaveAttribute('src', /^blob:/);
      expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    }
    // A foreign host and an empty playlist keep the icon; the tile is the same square either way (no shift).
    const covers = grid.getByTestId('music-tile-cover');
    await expect(covers).toHaveCount(5);
    await expect(grid.getByRole('img')).toHaveCount(3);
    const boxes = await covers.evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return [Math.round(r.width), Math.round(r.height)];
      }),
    );
    for (const [w, h] of boxes) expect(w).toBe(h);
    expect(new Set(boxes.map(([w]) => w)).size).toBe(1);
    const hosts = new Set(mock.images.map(host));
    expect(hosts.has('mosaic.scdn.co')).toBe(true);
    expect(hosts.has('image-cdn-ak.spotifycdn.com')).toBe(true);
    expect(hosts.has('image-cdn-fa.spotifycdn.com')).toBe(true);
    expect(hosts.has('covers.evil.test')).toBe(false);
    // One request per picture, in the size the tile needs: 300 on a plain screen, 640 on a sharp one (phone).
    expect(new Set(mock.images).size).toBe(mock.images.length);
    const sharp = (await page.evaluate(() => window.devicePixelRatio)) > 1.5;
    expect(mock.images.filter((u) => u.startsWith('https://mosaic.scdn.co/'))).toEqual([
      COVER.mosaic('fokus', sharp ? 640 : 300),
    ]);
  });

  test('a playlist shows its picture and the album picture of every row; the head shows what plays', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    withCovers(mock);
    await seedConnected(page, ALL);
    const main = await openMusic(page);
    await expect(page.getByTestId('music-cover').getByRole('img')).toHaveAttribute(
      'alt',
      'Album Jetzt',
    );
    await main.getByRole('button', { name: /Tiefer Fokus/ }).click();
    const rows = main.getByTestId('track-row');
    await expect(rows).toHaveCount(3);
    await rows.last().scrollIntoViewIfNeeded();
    await expect(rows.getByRole('img')).toHaveCount(3);
    // The phone layout has no picture in the list header (it keeps the header short).
    if ((page.viewportSize()?.width ?? 0) >= 900) {
      await main.getByTestId('music-list-cover').scrollIntoViewIfNeeded();
      await expect(main.getByTestId('music-list-cover').getByRole('img')).toBeVisible();
    }
    // Rows take the 64 px picture; two rows of one album share one request.
    const small = mock.images.filter((u) => u === COVER.album('Album Eins', 64));
    expect(small).toHaveLength(1);
    expect(mock.images).not.toContain(COVER.album('Album Eins', 640));
    const queue = page.getByTestId('music-queue');
    await queue.scrollIntoViewIfNeeded();
    await expect(queue.getByRole('img')).toHaveCount(1);
  });

  test('not connected: no picture is asked for', async ({ page }) => {
    const mock = await mockSpotify(page);
    withCovers(mock);
    await page.addInitScript(
      (url) => {
        localStorage.setItem(
          'tm-spotify-now',
          JSON.stringify({
            at: Date.now(),
            value: { title: 'Alt', artist: 'Band', playing: true, coverUrl: url },
          }),
        );
      },
      COVER.album('alt', 64),
    );
    // The module is on, the sign-in is stored, but "Anzeigen" is not granted: the page reads as not connected.
    await seedConnected(page, []);
    await ready(page, '/music');
    await expect(page.getByTestId('music-empty')).toBeVisible();
    await page.waitForTimeout(500);
    expect(mock.images).toEqual([]);
    expect(mock.api).toEqual([]);
  });
});

test.describe('Music page', () => {
  test('a playlist opens with all its songs; a tap plays that song inside the playlist', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    await seedConnected(page, ALL);
    const main = await openMusic(page);
    await main.getByRole('button', { name: /Tiefer Fokus/ }).click();
    await expect(main.getByRole('heading', { name: 'Tiefer Fokus' })).toBeVisible();
    await expect(main.getByTestId('track-row')).toHaveCount(3);
    await expect(main.getByTestId('track-row').first()).toContainText('Erstes Lied');
    await expect(main.getByTestId('track-row').first()).toContainText('Erfundenes Album');
    await expect(main.getByTestId('track-row').first()).toContainText('3:05');
    expect(mock.api.some((c) => c.startsWith('PUT /play'))).toBe(false); // looking plays nothing
    await main.getByRole('button', { name: 'Zweites Lied abspielen' }).click();
    await expect
      .poll(() =>
        mock.api.find((c) => c.startsWith('PUT /play') && c.includes('spotify:playlist:pl1ABC')),
      )
      .toContain('"uri":"spotify:track:sg2BBB"');
  });

  test('the start view is never empty: recently played and the playlists as covers', async ({
    page,
  }) => {
    await mockSpotify(page);
    await seedConnected(page, ALL);
    await openMusic(page);
    const start = page.getByTestId('music-start');
    await expect(start.getByRole('button', { name: /Gestern gehört/ })).toBeVisible();
    await expect(page.getByTestId('music-playlists').getByRole('button')).toHaveCount(2);
    await expect(page.getByTestId('music-queue')).toContainText('Als Nächstes');
    // The lists exist once, as chips; no second "Bibliothek" card repeats them (U51).
    await expect(
      page.getByRole('main').getByRole('button', { name: 'Lieblingssongs', exact: true }),
    ).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Bibliothek' })).toHaveCount(0);
  });

  test('phone: the five controls stay in one row; the heart sits beside the title', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await mockSpotify(page);
    await seedConnected(page, ALL);
    await openMusic(page);
    const controls = page.getByRole('group', { name: 'Wiedergabe steuern' });
    const tops = await controls
      .getByRole('button')
      .evaluateAll((els) => [
        ...new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))),
      ]);
    expect(tops).toHaveLength(1);
    const heart = page.getByTestId('music-now').getByRole('button', { name: /Lieblingssongs/ });
    const title = page.getByTestId('music-now').getByRole('heading', { level: 2 });
    const [h, t] = [await heart.boundingBox(), await title.boundingBox()];
    expect(Math.abs(h!.y + h!.height / 2 - (t!.y + t!.height / 2))).toBeLessThan(12);
  });

  test('the heart saves and removes a song in the liked songs', async ({ page }) => {
    const mock = await mockSpotify(page);
    await seedConnected(page, ALL);
    const main = await openMusic(page);
    await main.getByRole('button', { name: /Tiefer Fokus/ }).click();
    // The first song is saved (the mock says so); the others are not.
    await expect(
      main.getByRole('button', { name: 'Erstes Lied aus Lieblingssongs entfernen' }),
    ).toBeVisible();
    await main.getByRole('button', { name: 'Zweites Lied zu Lieblingssongs hinzufügen' }).click();
    await expect
      .poll(() => mock.api.some((c) => c.startsWith('PUT') && c.includes('/v1/me/tracks')))
      .toBe(true);
    await expect(
      main.getByRole('button', { name: 'Zweites Lied aus Lieblingssongs entfernen' }),
    ).toBeVisible();
  });

  test('a song can be hidden in a playlist and shown again; nothing is deleted at Spotify', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    await seedConnected(page, ALL);
    const main = await openMusic(page);
    await main.getByRole('button', { name: /Tiefer Fokus/ }).click();
    await main.getByRole('button', { name: 'Mehr zu Zweites Lied' }).click();
    await page.getByRole('menuitem', { name: 'In dieser Liste ausblenden' }).click();
    await expect(main.getByTestId('track-row')).toHaveCount(2);
    await expect(main).toContainText('1 ausgeblendet');
    // "Abspielen" skips it: the visible songs are the list.
    await main.getByRole('button', { name: 'Abspielen', exact: true }).click();
    await expect
      .poll(() => mock.api.find((c) => c.startsWith('PUT /play') && c.includes('"uris"')))
      .toContain('spotify:track:sg3CCC');
    expect(mock.api.find((c) => c.includes('"uris"'))).not.toContain('sg2BBB');
    expect(mock.api.some((c) => c.startsWith('DELETE'))).toBe(false);
    // Still hidden after leaving and coming back to the page.
    const again = await openMusic(page);
    await again.getByRole('button', { name: /Tiefer Fokus/ }).click();
    await expect(again.getByTestId('track-row')).toHaveCount(2);
    await again.getByRole('button', { name: 'Ausgeblendete zeigen' }).click();
    await expect(again.getByTestId('track-row')).toHaveCount(3);
  });

  test('queue: add a song, see what comes next; recent songs; switch the device', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    await seedConnected(page, ALL);
    const main = await openMusic(page);
    await main.getByRole('button', { name: /Tiefer Fokus/ }).click();
    await main.getByRole('button', { name: 'Mehr zu Drittes Lied' }).click();
    await page.getByRole('menuitem', { name: 'Zur Warteschlange hinzufügen' }).click();
    await expect.poll(() => mock.api.some((c) => c.startsWith('POST /queue'))).toBe(true);

    await chip(page, /Warteschlange/).click();
    await expect(main).toContainText('Als Nächstes');
    await expect(main.getByRole('button', { name: 'Als Nächstes abspielen' })).toBeVisible();

    await chip(page, /Zuletzt gespielt/).click();
    await expect(main.getByRole('button', { name: 'Gestern gehört abspielen' })).toBeVisible();

    await page.getByTestId('music-now').getByRole('button', { name: 'Geräte' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Auf Büro-PC abspielen' }).click();
    await expect
      .poll(() => mock.api.some((c) => c.startsWith('PUT') && c.includes('"device_ids":["dev2"]')))
      .toBe(true);
  });

  test('without the extra features the page says how to get them', async ({ page }) => {
    await mockSpotify(page);
    await seedConnected(page, ['show', 'control']);
    const main = await openMusic(page);
    await expect(page.getByTestId('music-start')).toContainText('„Playlists“');
    await chip(page, /Zuletzt gespielt/).click();
    await expect(main).toContainText('„Zuletzt gehört“ ankreuzen');
    await chip(page, /Lieblingssongs/).click();
    await expect(main).toContainText('„Lieblingssongs“');
  });

  test('no active device: a way out (devices, the Spotify app, the browser), not a dead end', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    mock.player = () => ({ status: 204 });
    mock.state = () => ({ status: 204 });
    await seedConnected(page, ALL);
    await ready(page, '/music');
    const panel = page.getByTestId('music-nodevice');
    await expect(panel).toContainText('Gerade läuft nichts');
    await expect(panel.getByRole('link', { name: /Spotify-App öffnen/ })).toHaveAttribute(
      'href',
      'spotify:',
    );
    await expect(panel.getByRole('button', { name: 'Im Browser öffnen' })).toBeVisible();
    await panel.getByRole('button', { name: 'Hier abspielen: Büro-PC' }).click();
    await expect
      .poll(() => mock.api.some((c) => c.startsWith('PUT') && c.includes('"device_ids":["dev2"]')))
      .toBe(true);
    // The page below the head is not empty.
    await expect(page.getByTestId('music-start')).toBeVisible();
  });

  test('the page fits the screen: no sideways scroll, the controls are in view, the head is a head and not a dialog', async ({
    page,
  }) => {
    await mockSpotify(page);
    await seedConnected(page, ALL);
    const main = await openMusic(page);
    await main.getByRole('button', { name: /Tiefer Fokus/ }).click();
    await expect(page.getByTestId('module-frame')).toHaveAttribute('data-hue', 'orchid');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByTestId('player-toggle')).toBeInViewport();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });
});
