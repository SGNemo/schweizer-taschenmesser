import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { ready, showPreview } from '../helpers';
import { mockSpotify, seedConnected } from '../spotify-mock';
import { mockWeather } from '../weather-mock';

/**
 * Manual tooling (playwright.screens.config.ts, project `plain`): screenshots of the two modules that open as
 * pages (weather, music; before identity v2 they were dialogs) with invented API answers. Output: SCREENS_DIR.
 */
const OUT = process.env.SCREENS_DIR ?? 'test-results/screens/current';
const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '2560x1440', width: 2560, height: 1440 },
  { name: '412x915', width: 412, height: 915, mobile: true },
];
const scheme = (process.env.SCREENS_SCHEME as 'light' | 'dark' | undefined) ?? 'light';

test('capture weather and music pages', async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile ?? false,
      hasTouch: vp.mobile ?? false,
      reducedMotion: 'reduce',
      colorScheme: scheme,
      locale: 'de-DE',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
    await showPreview(page);
    await mockWeather(page);
    const spotify = await mockSpotify(page);

    // Weather: choose a place, open the preview from the overview line.
    await ready(page, '/settings/verbindungen');
    await page.getByLabel('Ort suchen').fill('Bern');
    await page
      .locator('#weather--place')
      .getByRole('button', { name: 'Suchen', exact: true })
      .click();
    await page.getByRole('button', { name: 'Bern, Schweiz wählen' }).click();
    await ready(page, '/weather');
    await expect(page.getByTestId('weather-preview')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${vp.name}--weather.png` });

    // Spotify, playing.
    await seedConnected(page, ['show', 'control', 'playlists', 'library', 'history']);
    await ready(page, '/music');
    await expect(page.getByTestId('music-now')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${vp.name}--spotify-playing.png` });

    // Spotify, no active device: 204 answers for the player.
    spotify.player = () => ({ status: 204 });
    spotify.state = () => ({ status: 204 });
    await ready(page, '/music');
    await expect(page.getByTestId('music-nodevice')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${vp.name}--spotify-nodevice.png` });
    await context.close();
  }
});
