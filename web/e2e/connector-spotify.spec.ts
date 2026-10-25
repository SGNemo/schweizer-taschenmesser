import { expect, test } from '@playwright/test';
import { ready } from './helpers';
import { mockSpotify, seedConnected } from './spotify-mock';

/**
 * Spotify connector: the line "Läuft gerade" and its controls against a mocked Web API. The login
 * itself (browser, redirect on port 38417) is a hand test (docs/MANUAL-TESTS.md S1–S4); here a
 * connected state with invented tokens is written into the app's device-local stores.
 */

test.describe('Spotify connector', () => {
  test('settings: the card is there, says desktop only and offers no login on this device', async ({
    page,
  }) => {
    await ready(page, '/settings/verbindungen');
    const card = page.getByTestId('connector-spotify');
    await expect(card).toBeVisible();
    await expect(card.getByText('Nicht verbunden')).toBeVisible();
    await expect(card.getByText(/nur in der Windows-App/)).toBeVisible();
    await expect(card.getByRole('button', { name: 'Verbinden' })).toHaveCount(0);
  });

  test('not connected: no line and no request to Spotify', async ({ page }) => {
    const mock = await mockSpotify(page);
    await ready(page, '/');
    await expect(page.getByTestId('widget-todos:next')).toBeVisible();
    await expect(page.getByTestId('now-playing-line')).toHaveCount(0);
    expect(mock.api).toEqual([]);
  });

  test('connected: one calm line with the title as a link, pause/resume and next', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    await seedConnected(page, ['show', 'control']);
    await ready(page, '/');
    const line = page.getByTestId('now-playing-line');
    await expect(line).toContainText('Läuft gerade: Testlied – Erfundene Band');
    const link = line.getByRole('link', { name: 'Testlied' });
    await expect(link).toHaveAttribute('href', 'https://open.spotify.com/track/abc123');
    await expect(link).toHaveAttribute('rel', 'noreferrer noopener');

    await line.getByRole('button', { name: 'Pause' }).click();
    await expect(line).toContainText('Pausiert: Testlied');
    await line.getByRole('button', { name: 'Weiter' }).click();
    await expect(line).toContainText('Läuft gerade: Testlied');
    await line.getByRole('button', { name: 'Nächster' }).click();
    await expect.poll(() => mock.api).toContain('POST /next');
    expect(mock.api).toContain('PUT /pause');
    expect(mock.api).toContain('PUT /play');
  });

  test('display only: no controls without the "Steuern" feature', async ({ page }) => {
    await mockSpotify(page);
    await seedConnected(page, ['show']);
    await ready(page, '/');
    const line = page.getByTestId('now-playing-line');
    await expect(line).toContainText('Testlied');
    await expect(line.getByRole('button')).toHaveCount(0);
  });

  test('nothing playing (204): the line is not there', async ({ page }) => {
    const mock = await mockSpotify(page);
    mock.player = () => ({ status: 204 });
    await seedConnected(page, ['show', 'control']);
    await ready(page, '/');
    await expect.poll(() => mock.api).toContain('GET /currently-playing');
    await expect(page.getByTestId('now-playing-line')).toHaveCount(0);
  });

  test('without Premium the controls go away with one quiet hint, the display stays', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    mock.command = () => ({
      status: 403,
      body: { error: { status: 403, reason: 'PREMIUM_REQUIRED', message: 'Premium required' } },
    });
    await seedConnected(page, ['show', 'control']);
    await ready(page, '/');
    const line = page.getByTestId('now-playing-line');
    await line.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByText('Steuern braucht Spotify Premium.')).toBeVisible();
    await expect(line.getByRole('button')).toHaveCount(0);
    await expect(line).toContainText('Testlied');
  });

  test('an expired sign-in turns the line off and the card says so', async ({ page }) => {
    const mock = await mockSpotify(page);
    mock.player = () => ({ status: 401, body: { error: { status: 401 } } });
    await seedConnected(page, ['show']);
    await ready(page, '/');
    await expect.poll(() => mock.api.length).toBeGreaterThan(0);
    await expect(page.getByTestId('now-playing-line')).toHaveCount(0);
    await ready(page, '/settings/verbindungen');
    await expect(
      page.getByTestId('connector-spotify').getByText('Abgelaufen', { exact: true }),
    ).toBeVisible();
  });
});
