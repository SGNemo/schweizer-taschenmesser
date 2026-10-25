import { expect, test, type Page } from '@playwright/test';
import { openFoldedGroup, openMoreFocus, ready } from './helpers';
import { mockSpotify, seedConnected } from './spotify-mock';

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

async function openMusicRow(page: Page) {
  await ready(page, '/settings/darstellung');
  await openMoreFocus(page);
  await openFoldedGroup(page, 'focus', 'music');
  return page.getByTestId('focus-group-music');
}

const startRound = async (page: Page) => {
  await ready(page, '/');
  await page
    .getByTestId('next-card')
    .getByRole('button', { name: /Anfangen/ })
    .click();
  await expect(page.getByRole('timer')).toBeVisible();
};

/** Commands only (reads of the Overview line and of the playlist list do not steer the player). */
const player = (api: string[]) => api.filter((c) => c.startsWith('PUT ') || c.startsWith('POST '));

test.describe('Spotify music in the focus round', () => {
  test('the row is not there without Spotify', async ({ page }) => {
    await mockSpotify(page);
    await ready(page, '/settings/darstellung');
    await openMoreFocus(page);
    await expect(page.getByTestId('focus-group-music')).toHaveCount(0);
  });

  test('connected with "Anzeigen" only: no row either (nothing to steer)', async ({ page }) => {
    await mockSpotify(page);
    await seedConnected(page, ['show']);
    await ready(page, '/settings/darstellung');
    await openMoreFocus(page);
    await expect(page.getByTestId('focus-group-music')).toHaveCount(0);
  });

  test('off by default: a round never touches the player', async ({ page }) => {
    const mock = await mockSpotify(page);
    await seedConnected(page, ['show', 'control', 'playlists']);
    await addTodo(page, 'Formular ausfüllen');
    await startRound(page);
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(player(mock.api)).toEqual([]);
  });

  test('"Playlist starten": choose once, play at the start, pause at the end, nothing between', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    await seedConnected(page, ['show', 'control', 'playlists']);
    const row = await openMusicRow(page);
    await expect(row).toContainText('Aus');
    expect(mock.api).not.toContain('GET /v1/me/playlists?limit=50');
    await row.getByRole('button', { name: 'Playlist starten' }).click();
    await row.getByTestId('focus-music-playlist').selectOption('pl1ABC');
    await expect(row).toContainText('Playlist starten');

    await addTodo(page, 'Formular ausfüllen');
    await startRound(page);
    await expect
      .poll(() => player(mock.api))
      .toEqual(['PUT /play {"context_uri":"spotify:playlist:pl1ABC"}']);
    await page.waitForTimeout(1500);
    expect(player(mock.api)).toHaveLength(1);
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect.poll(() => player(mock.api)).toHaveLength(2);
    expect(player(mock.api)[1]).toBe('PUT /pause');
  });

  test('"Beim Start weiterspielen" resumes; "Am Ende pausieren" can be switched off', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    await seedConnected(page, ['show', 'control']);
    const row = await openMusicRow(page);
    await row.getByRole('button', { name: 'Beim Start weiterspielen' }).click();
    await row.getByRole('switch', { name: 'Am Ende pausieren' }).click();
    await addTodo(page, 'Etwas tun');
    await startRound(page);
    await expect.poll(() => player(mock.api)).toEqual(['PUT /play']);
    await page.getByRole('button', { name: 'Runde beenden' }).click();
    await expect(page.getByText('Fokus beendet. Dein Stand ist gespeichert.')).toBeVisible();
    await page.waitForTimeout(500);
    expect(player(mock.api)).toEqual(['PUT /play']);
  });

  test('Spotify fails: the round runs on normally with one calm line, no error toast', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    mock.command = () => ({ status: 404, body: { error: { reason: 'NO_ACTIVE_DEVICE' } } });
    await seedConnected(page, ['show', 'control']);
    const row = await openMusicRow(page);
    await row.getByRole('button', { name: 'Beim Start weiterspielen' }).click();
    await addTodo(page, 'Etwas tun');
    await startRound(page);
    await expect(page.getByTestId('focus-music-status')).toHaveText('Musik: nicht erreichbar');
    await expect(page.getByRole('timer')).toContainText(/2[45]:\d\d/);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.getByText('Erledigt. Gut gemacht.')).toBeVisible();
  });

  test('without Premium the row disappears after the first try; the round is not disturbed', async ({
    page,
  }) => {
    const mock = await mockSpotify(page);
    mock.command = () => ({ status: 403, body: { error: { reason: 'PREMIUM_REQUIRED' } } });
    await seedConnected(page, ['show', 'control']);
    const row = await openMusicRow(page);
    await row.getByRole('button', { name: 'Beim Start weiterspielen' }).click();
    await addTodo(page, 'Etwas tun');
    await startRound(page);
    await expect(page.getByTestId('focus-music-status')).toBeVisible();
    await ready(page, '/settings/darstellung');
    await openMoreFocus(page);
    await expect(page.getByTestId('focus-group-music')).toHaveCount(0);
  });

  test('the music row fits a phone and stays inside "Weitere Einstellungen"', async ({ page }) => {
    await mockSpotify(page);
    await seedConnected(page, ['show', 'control']);
    const row = await openMusicRow(page);
    const box = await row.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    await expect(page.getByTestId('focus-more').getByTestId('focus-group-music')).toBeVisible();
  });
});
