import { expect, test } from '@playwright/test';
import { enable, ready, showAllWidgets, showPreview } from './helpers';
import { CORS, mockSpotify, seedConnected } from './spotify-mock';

/**
 * Spotify connector: the line "Läuft gerade" and its controls against a mocked Web API. The login
 * itself (browser, redirect on port 38417) is a hand test (docs/MANUAL-TESTS.md S1–S4); here a
 * connected state with invented tokens is written into the app's device-local stores.
 */

// Preview modules, tools, connectors and sections are listed only with "In Arbeit anzeigen" (maturity).
test.beforeEach(({ page }) => showPreview(page));

test.describe('Spotify connector', () => {
  test('settings, Android app: the card explains where signing in works and offers no login', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'android'));
    await ready(page, '/settings/verbindungen');
    const card = page.getByTestId('connector-spotify');
    await expect(card).toBeVisible();
    await expect(card.getByText('Nicht verbunden')).toBeVisible();
    await expect(card.getByText(/Windows-App und im Browser/)).toBeVisible();
    await expect(card.getByRole('button', { name: 'Verbinden' })).toHaveCount(0);
  });

  test("settings, browser: names the app's own redirect address and offers the login", async ({
    page,
  }) => {
    await ready(page, '/settings/verbindungen');
    const card = page.getByTestId('connector-spotify');
    await expect(card.getByText('Nicht verbunden')).toBeVisible();
    await expect(card.getByText(/\/oauth\/callback/)).toBeVisible();
    await expect(card.getByText(/38417/)).toHaveCount(0);
    // Fresh card: the two basic features are ticked, the optional ones are not.
    await expect(card.getByRole('checkbox', { name: /^Anzeigen/ })).toBeChecked();
    await expect(card.getByRole('checkbox', { name: /^Steuern/ })).toBeChecked();
    await expect(card.getByRole('checkbox', { name: /^Playlists/ })).not.toBeChecked();
    await expect(card.getByRole('button', { name: 'Verbinden' })).toBeEnabled();
  });

  test('browser login: to Spotify and back to the callback address, then connected', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    const authorize: string[] = [];
    // The provider's login page: answer with the redirect back to the app, carrying the state.
    await page.route('https://accounts.spotify.com/authorize**', (route) => {
      const url = new URL(route.request().url());
      authorize.push(url.search);
      const back = new URL(url.searchParams.get('redirect_uri')!);
      back.searchParams.set('code', 'CODE-invented');
      back.searchParams.set('state', url.searchParams.get('state')!);
      return route.fulfill({ status: 302, headers: { location: back.toString() } });
    });
    let tokenBody = '';
    await page.route('https://accounts.spotify.com/api/token', (route) => {
      tokenBody = route.request().postData() ?? '';
      return route.fulfill({
        status: 200,
        headers: CORS,
        json: { access_token: 'AT-invented', refresh_token: 'RT-invented', expires_in: 3600 },
      });
    });
    await ready(page, '/settings/verbindungen');
    const card = page.getByTestId('connector-spotify');
    await card.getByLabel('Client-ID').fill('client-invented-123');
    await card.getByRole('button', { name: 'Speichern' }).click();
    await expect(card.getByPlaceholder('••••••••')).toBeVisible();
    await card.getByRole('button', { name: 'Verbinden' }).click();

    // Back in the app on the connection card: connected, and the address holds no code any more.
    await expect(page).toHaveURL(/\/settings\/verbindungen/);
    await expect(page.getByTestId('connector-spotify').getByText('Verbunden')).toBeVisible();
    expect(page.url()).not.toContain('code=');
    const query = new URLSearchParams(authorize[0]);
    expect(query.get('scope')).toBe(
      'user-read-currently-playing user-read-playback-state user-modify-playback-state',
    );
    expect(query.get('code_challenge_method')).toBe('S256');
    expect(tokenBody).toContain('grant_type=authorization_code');
    expect(tokenBody).toContain('code=CODE-invented');
    expect(tokenBody).toContain('code_verifier=');
    expect(decodeURIComponent(tokenBody)).toContain('/oauth/callback');

    // The music page works with that login (a preview module: switched on like the library does).
    await enable(page, 'music');
    await ready(page, '/music');
    await expect(page.getByTestId('music-now')).toContainText('Testlied');
    expect(mock.api.length).toBeGreaterThan(0);
  });

  test('browser login: a forged callback address connects nothing', async ({ page }) => {
    await mockSpotify(page);
    await page.goto('/oauth/callback?code=forged&state=nothing-pending-123456');
    await expect(page).toHaveURL(/\/settings\/verbindungen/);
    await expect(page.getByTestId('connector-spotify').getByText('Nicht verbunden')).toBeVisible();
  });

  test('browser login: refusing at Spotify leaves the card on "Nicht verbunden"', async ({
    page,
  }) => {
    await mockSpotify(page);
    await page.route('https://accounts.spotify.com/authorize**', (route) => {
      const url = new URL(route.request().url());
      const back = new URL(url.searchParams.get('redirect_uri')!);
      back.searchParams.set('error', 'access_denied');
      back.searchParams.set('state', url.searchParams.get('state')!);
      return route.fulfill({ status: 302, headers: { location: back.toString() } });
    });
    await ready(page, '/settings/verbindungen');
    const card = page.getByTestId('connector-spotify');
    await card.getByLabel('Client-ID').fill('client-invented-123');
    await card.getByRole('button', { name: 'Speichern' }).click();
    await card.getByRole('button', { name: 'Verbinden' }).click();
    await expect(page).toHaveURL(/\/settings\/verbindungen/);
    await expect(page.getByTestId('connector-spotify').getByText('Nicht verbunden')).toBeVisible();
    await expect(page.getByTestId('connector-spotify').getByRole('alert')).toHaveCount(0);
  });

  test('not connected: the widget offers to connect, and no request goes to Spotify', async ({
    page,
  }) => {
    await showAllWidgets(page);
    const mock = await mockSpotify(page);
    // The module is a preview module: switch it on like the library does.
    await enable(page, 'music');
    await ready(page, '/music');
    await expect(page.getByTestId('music-empty')).toContainText('Verbinde Spotify');
    expect(mock.api).toEqual([]);
  });

  test('connected: the widget shows what plays with pause/resume and next; the title opens the module as a page', async ({
    page,
  }) => {
    await showAllWidgets(page);
    const mock = await mockSpotify(page);
    await seedConnected(page, ['show', 'control']);
    await ready(page, '/');
    const widget = page.getByTestId('widget-music:player');
    await expect(widget).toContainText('Testlied');
    await expect(widget).toContainText('Erfundene Band');
    await widget.getByRole('button', { name: 'Pause' }).click();
    await expect(widget.getByRole('button', { name: 'Weiter' })).toBeVisible();
    await widget.getByRole('button', { name: 'Weiter' }).click();
    await expect(widget.getByRole('button', { name: 'Pause' })).toBeVisible();
    await widget.getByRole('button', { name: 'Nächster' }).click();
    await expect.poll(() => mock.api).toContain('POST /next');
    expect(mock.api).toContain('PUT /pause');
    expect(mock.api).toContain('PUT /play');
    await widget.getByRole('link', { name: /Musik/ }).first().click();
    await expect(page).toHaveURL(/\/music$/);
    await expect(page.getByTestId('music-now')).toContainText('Testlied');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('display only: no controls without the "Steuern" feature', async ({ page }) => {
    await showAllWidgets(page);
    await mockSpotify(page);
    await seedConnected(page, ['show']);
    await ready(page, '/');
    const widget = page.getByTestId('widget-music:player');
    await expect(widget).toContainText('Testlied');
    await expect(widget.getByTestId('now-playing-toggle')).toHaveCount(0);
    await expect(widget.getByTestId('now-playing-next')).toHaveCount(0);
  });

  test('nothing playing (204): the widget gives way to one quiet line', async ({ page }) => {
    await showAllWidgets(page);
    const mock = await mockSpotify(page);
    mock.player = () => ({ status: 204 });
    await seedConnected(page, ['show', 'control']);
    await ready(page, '/');
    await expect.poll(() => mock.api).toContain('GET /currently-playing');
    await expect(page.getByTestId('widget-music:player')).toContainText('Gerade läuft nichts.');
  });

  test('without Premium the controls go away with one quiet hint, the display stays', async ({
    page,
  }) => {
    await showAllWidgets(page);
    const mock = await mockSpotify(page);
    mock.command = () => ({
      status: 403,
      body: { error: { status: 403, reason: 'PREMIUM_REQUIRED', message: 'Premium required' } },
    });
    await seedConnected(page, ['show', 'control']);
    await ready(page, '/');
    const widget = page.getByTestId('widget-music:player');
    await widget.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByText('Steuern braucht Spotify Premium.')).toBeVisible();
    await expect(widget.getByTestId('now-playing-toggle')).toHaveCount(0);
    await expect(widget.getByTestId('now-playing-next')).toHaveCount(0);
    await expect(widget).toContainText('Testlied');
  });

  test('an expired sign-in turns the widget off and the card says so', async ({ page }) => {
    await showAllWidgets(page);
    const mock = await mockSpotify(page);
    mock.player = () => ({ status: 401, body: { error: { status: 401 } } });
    await seedConnected(page, ['show']);
    await ready(page, '/');
    await expect.poll(() => mock.api.length).toBeGreaterThan(0);
    await expect(page.getByTestId('widget-music:player')).toContainText('Verbinde Spotify');
    await ready(page, '/settings/verbindungen');
    await expect(
      page.getByTestId('connector-spotify').getByText('Abgelaufen', { exact: true }),
    ).toBeVisible();
  });
});
