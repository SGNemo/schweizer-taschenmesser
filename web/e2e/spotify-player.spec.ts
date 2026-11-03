import { expect, test, type Page } from '@playwright/test';
import { ready, showPreview } from './helpers';
import { mockSpotify, seedConnected } from './spotify-mock';

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
/** The view chips of the toolbar (the library in the aside has the same names). */
const chip = (page: Page, name: RegExp | string) =>
  page.getByRole('navigation', { name: 'Ansichten' }).getByRole('button', { name });

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
    await expect(page.getByTestId('player-toggle')).toBeInViewport();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });
});
