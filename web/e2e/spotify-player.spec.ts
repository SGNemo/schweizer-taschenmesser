import { expect, test, type Locator, type Page } from '@playwright/test';
import { ready } from './helpers';
import { mockSpotify, seedConnected } from './spotify-mock';

/**
 * The Spotify player (library | list | bar) against a mocked Web API: open a playlist and see every song,
 * play one inside its playlist, save a song with the heart, hide one, queue one, switch the device.
 */
const ALL = ['show', 'control', 'playlists', 'library', 'history'];

async function openPlayer(page: Page) {
  await ready(page, '/');
  await page.getByTestId('now-playing-open').click();
  const player = page.getByTestId('spotify-player');
  await expect(player).toBeVisible();
  return player;
}

/** On a phone the library and the opened list take turns: go back to the library first. */
async function toLibrary(player: Locator) {
  const back = player.getByRole('button', { name: 'Zurück zur Bibliothek' });
  if (await back.isVisible()) await back.click();
}

test.describe('Spotify player', () => {
  test('a playlist opens with all its songs; a tap plays that song inside the playlist', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    await seedConnected(page, ALL);
    const player = await openPlayer(page);
    await player.getByRole('button', { name: /Tiefer Fokus/ }).click();
    await expect(player.getByRole('heading', { name: 'Tiefer Fokus' })).toBeVisible();
    await expect(player.getByTestId('track-row')).toHaveCount(3);
    await expect(player.getByTestId('track-row').first()).toContainText('Erstes Lied');
    await expect(player.getByTestId('track-row').first()).toContainText('Erfundenes Album');
    await expect(player.getByTestId('track-row').first()).toContainText('3:05');
    expect(mock.api.some((c) => c.startsWith('PUT /play'))).toBe(false); // looking plays nothing
    await player.getByRole('button', { name: 'Zweites Lied abspielen' }).click();
    await expect
      .poll(() =>
        mock.api.find((c) => c.startsWith('PUT /play') && c.includes('spotify:playlist:pl1ABC')),
      )
      .toContain('"uri":"spotify:track:sg2BBB"');
  });

  test('the heart saves and removes a song in the liked songs', async ({ page }) => {
    const mock = await mockSpotify(page);
    await seedConnected(page, ALL);
    const player = await openPlayer(page);
    await player.getByRole('button', { name: /Tiefer Fokus/ }).click();
    // The first song is saved (the mock says so); the others are not.
    await expect(
      player.getByRole('button', { name: 'Erstes Lied aus Lieblingssongs entfernen' }),
    ).toBeVisible();
    await player.getByRole('button', { name: 'Zweites Lied zu Lieblingssongs hinzufügen' }).click();
    await expect
      .poll(() => mock.api.some((c) => c.startsWith('PUT') && c.includes('/v1/me/tracks')))
      .toBe(true);
    await expect(
      player.getByRole('button', { name: 'Zweites Lied aus Lieblingssongs entfernen' }),
    ).toBeVisible();
  });

  test('a song can be hidden in a playlist and shown again; nothing is deleted at Spotify', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    await seedConnected(page, ALL);
    const player = await openPlayer(page);
    await player.getByRole('button', { name: /Tiefer Fokus/ }).click();
    await player.getByRole('button', { name: 'Mehr zu Zweites Lied' }).click();
    await page.getByRole('menuitem', { name: 'In dieser Liste ausblenden' }).click();
    await expect(player.getByTestId('track-row')).toHaveCount(2);
    await expect(player).toContainText('1 ausgeblendet');
    // "Abspielen" skips it: the visible songs are the list.
    await player.getByRole('button', { name: 'Abspielen', exact: true }).click();
    await expect
      .poll(() => mock.api.find((c) => c.startsWith('PUT /play') && c.includes('"uris"')))
      .toContain('spotify:track:sg3CCC');
    expect(mock.api.find((c) => c.includes('"uris"'))).not.toContain('sg2BBB');
    expect(mock.api.some((c) => c.startsWith('DELETE'))).toBe(false);
    // Still hidden after closing and opening the player again.
    await page.keyboard.press('Escape');
    await page.getByTestId('now-playing-open').click();
    await player.getByRole('button', { name: /Tiefer Fokus/ }).click();
    await expect(player.getByTestId('track-row')).toHaveCount(2);
    await player.getByRole('button', { name: 'Ausgeblendete zeigen' }).click();
    await expect(player.getByTestId('track-row')).toHaveCount(3);
  });

  test('queue: add a song, see what comes next; recent songs; switch the device', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    await seedConnected(page, ALL);
    const player = await openPlayer(page);
    await player.getByRole('button', { name: /Tiefer Fokus/ }).click();
    await player.getByRole('button', { name: 'Mehr zu Drittes Lied' }).click();
    await page.getByRole('menuitem', { name: 'Zur Warteschlange hinzufügen' }).click();
    await expect.poll(() => mock.api.some((c) => c.startsWith('POST /queue'))).toBe(true);

    await toLibrary(player);
    await player.getByRole('button', { name: /Warteschlange/ }).click();
    await expect(player).toContainText('Als Nächstes');
    await expect(player.getByRole('button', { name: 'Als Nächstes abspielen' })).toBeVisible();

    await toLibrary(player);
    await player.getByRole('button', { name: /Zuletzt gespielt/ }).click();
    await expect(player.getByRole('button', { name: 'Gestern gehört abspielen' })).toBeVisible();

    await player.getByRole('button', { name: 'Geräte' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Auf Büro-PC abspielen' }).click();
    await expect
      .poll(() => mock.api.some((c) => c.startsWith('PUT') && c.includes('"device_ids":["dev2"]')))
      .toBe(true);
  });

  test('without the extra features the library says how to get them', async ({ page }) => {
    await mockSpotify(page);
    await seedConnected(page, ['show', 'control']);
    const player = await openPlayer(page);
    await expect(player).toContainText('„Playlists“ ankreuzen');
    await player.getByRole('button', { name: /Zuletzt gespielt/ }).click();
    await expect(player).toContainText('„Zuletzt gehört“ ankreuzen');
    await toLibrary(player);
    await player.getByRole('button', { name: /Lieblingssongs/ }).click();
    await expect(player).toContainText('„Lieblingssongs“');
  });

  test('the player fits the screen: no sideways scroll, the bar stays in view', async ({
    page,
  }) => {
    await mockSpotify(page);
    await seedConnected(page, ALL);
    const player = await openPlayer(page);
    await player.getByRole('button', { name: /Tiefer Fokus/ }).click();
    const box = (await player.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    await expect(player.getByTestId('player-toggle')).toBeInViewport();
    const overflow = await player.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
