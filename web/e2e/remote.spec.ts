import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The module "Fernbedienung" (phone) against the demo PC of `core/platform/fakeRemote.ts` (E2E
 * builds only): volume 42 %, answers with its state after every press. The real connection lives
 * in the native shell (Rust tests in `src-tauri`).
 */
interface Hooks {
  failOpen(code: string, count?: number): void;
  close(reason?: string | null): void;
  setState(patch: { volume?: number; mute?: boolean; playing?: boolean }): void;
  sent(): string[];
  isOpen(): boolean;
}
declare global {
  interface Window {
    __tmRemote: Hooks;
  }
}

test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

async function asPhoneWithRemote(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('__tmPlatformKind', 'android');
    localStorage.setItem('tm-e2e-remote', '1');
    // a preview module: listed with "In Arbeit anzeigen"
    localStorage.setItem('tm-show-preview', '1');
  });
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          tx.objectStore('_modules').put({
            id: 'remote',
            enabled: true,
            dataPolicy: null,
            createdAt: 1,
            updatedAt: 1,
            deviceId: 'e2e',
            deletedAt: null,
            _f: {},
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

test('pause, louder and quieter on the PC, one-handed', async ({ page }, info) => {
  await asPhoneWithRemote(page);
  await page.goto('/remote');
  const state = page.getByTestId('remote-state');
  await expect(state).toHaveText('Dein PC · Lautstärke 42 %');
  await page.screenshot({ path: info.outputPath('remote-1-media.png') });

  // the buttons sit in the lower half of the screen (thumb zone), volume lowest
  const play = await page.getByTestId('remote-play-pause').boundingBox();
  const louder = await page.getByTestId('remote-volume-up').boundingBox();
  expect(play!.y).toBeGreaterThan(915 / 2);
  expect(louder!.y).toBeGreaterThan(play!.y);
  expect(louder!.height).toBeGreaterThanOrEqual(44);

  await page.getByTestId('remote-volume-up').click();
  await expect(state).toHaveText('Dein PC · Lautstärke 44 %');
  await page.getByTestId('remote-volume-down').click();
  await page.getByTestId('remote-volume-down').click();
  await expect(state).toHaveText('Dein PC · Lautstärke 40 %');

  await expect(page.getByTestId('remote-play-pause')).toHaveText('Wiedergabe');
  await page.getByTestId('remote-play-pause').click();
  await expect(page.getByTestId('remote-play-pause')).toHaveText('Pause');

  // someone turns the volume at the PC: the phone follows
  await page.evaluate(() => window.__tmRemote.setState({ volume: 80 }));
  await expect(state).toHaveText('Dein PC · Lautstärke 80 %');

  // "Ton aus" from the menu; "Lauter" lifts it again
  await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
  await page.getByRole('menuitem', { name: 'Ton aus / an' }).click();
  await expect(state).toHaveText('Dein PC · Ton aus');
  await page.getByTestId('remote-volume-up').click();
  await expect(state).toHaveText('Dein PC · Lautstärke 82 %');

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('ended at the PC: the phone says so and offers one step', async ({ page }, info) => {
  await asPhoneWithRemote(page);
  await page.goto('/remote');
  const state = page.getByTestId('remote-state');
  await expect(state).toHaveText('Dein PC · Lautstärke 42 %');
  await page.evaluate(() => window.__tmRemote.close('ended'));
  await expect(state).toContainText('Die Fernbedienung ist am PC pausiert.');
  await expect(page.getByTestId('remote-play-pause')).toBeDisabled();
  await page.screenshot({ path: info.outputPath('remote-2-paused.png') });

  // switched on again at the PC: "Erneut versuchen" connects
  await page.getByTestId('remote-retry').click();
  await expect(state).toHaveText('Dein PC · Lautstärke 42 %');
  await expect(page.getByTestId('remote-play-pause')).toBeEnabled();
});

test('no PC paired: a sentence and the way to pairing', async ({ page }) => {
  await asPhoneWithRemote(page);
  await page.addInitScript(() => {
    const wait = setInterval(() => {
      if (window.__tmRemote) {
        window.__tmRemote.failOpen('not-paired', 99);
        clearInterval(wait);
      }
    }, 5);
  });
  await page.goto('/remote');
  await expect(page.getByTestId('remote-state')).toContainText('Noch kein PC gekoppelt.');
  await expect(page.getByRole('link', { name: 'PC koppeln' })).toBeVisible();
});

test('leaving the page ends the session', async ({ page }) => {
  await asPhoneWithRemote(page);
  await page.goto('/remote');
  await expect(page.getByTestId('remote-state')).toHaveText('Dein PC · Lautstärke 42 %');
  expect(await page.evaluate(() => window.__tmRemote.isOpen())).toBe(true);
  await page.getByRole('link', { name: 'Übersicht' }).first().click();
  await expect.poll(() => page.evaluate(() => window.__tmRemote.isOpen())).toBe(false);
});
