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
  pointed(): { kind: 'move' | 'scroll'; dx: number; dy: number }[];
  level(): 'media' | 'full' | undefined;
  unlocks(): number;
  setUnlock(answer: 'ok' | 'cancel' | 'none' | 'unavailable'): void;
}
declare global {
  interface Window {
    __tmRemote: Hooks;
  }
}

test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

async function asPhoneWithRemote(page: Page, grant?: 'full' | 'full:unlock') {
  await page.addInitScript((grant) => {
    localStorage.setItem('__tmPlatformKind', 'android');
    localStorage.setItem('tm-e2e-remote', '1');
    if (grant) localStorage.setItem('tm-e2e-remote-grant', grant);
    // a preview module: listed with "In Arbeit anzeigen"
    localStorage.setItem('tm-show-preview', '1');
  }, grant);
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
  // with the tabs the page still fits the screen: nothing to scroll
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight),
  ).toBeLessThanOrEqual(1);

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

  // holding "Lauter": the first step comes at once, then a few more – never a pile
  const before = await page.evaluate(() => window.__tmRemote.sent().length);
  const box = (await page.getByTestId('remote-volume-up').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect
    .poll(() => page.evaluate(() => window.__tmRemote.sent().length))
    .toBeGreaterThan(before);
  await page.waitForTimeout(900);
  await page.mouse.up();
  const steps = (await page.evaluate(() => window.__tmRemote.sent().length)) - before;
  expect(steps).toBeGreaterThanOrEqual(3);
  expect(steps).toBeLessThanOrEqual(6);
  await page.evaluate(() => window.__tmRemote.setState({ volume: 40, playing: true }));

  // someone turns the volume at the PC: the phone follows
  await page.evaluate(() => window.__tmRemote.setState({ volume: 80 }));
  await expect(state).toHaveText('Dein PC · Lautstärke 80 %');

  // "Ton aus" from the menu; "Lauter" lifts it again
  await page.getByRole('button', { name: 'Weitere Aktionen' }).click();
  await page.getByRole('menuitem', { name: 'Ton aus' }).click();
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
  // an inactive main key is not a filled accent button any more
  expect(
    await page
      .getByTestId('remote-play-pause')
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe('rgba(0, 0, 0, 0)');
  await page.screenshot({ path: info.outputPath('remote-2-paused.png') });

  // switched on again at the PC: "Erneut versuchen" connects
  await page.getByTestId('remote-retry').click();
  await expect(state).toHaveText('Dein PC · Lautstärke 42 %');
  await expect(page.getByTestId('remote-play-pause')).toBeEnabled();
});

test('no PC paired: a sentence and the way to pairing', async ({ page }) => {
  await asPhoneWithRemote(page);
  await page.addInitScript(() => localStorage.setItem('tm-e2e-remote-fail', 'not-paired:99'));
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

test('touchpad: slide, tap, hold "Links" to drag – on a phone the PC granted mouse and keyboard', async ({
  page,
}, info) => {
  await asPhoneWithRemote(page, 'full');
  await page.goto('/remote');
  const state = page.getByTestId('remote-state');
  await expect(state).toHaveText('Dein PC · Lautstärke 42 %');
  // Medien alone never asks for the mouse level
  expect(await page.evaluate(() => window.__tmRemote.level())).toBe('media');

  await page.getByRole('button', { name: 'Touchpad' }).click();
  // the one-time legend names the gestures; closed, it stays closed
  await expect(page.getByTestId('remote-legend')).toContainText('Wischen bewegt den Zeiger.');
  await page.screenshot({ path: info.outputPath('remote-4-touchpad-legend.png') });
  await page.getByTestId('remote-legend-close').click();
  await expect(page.getByTestId('remote-legend')).toHaveCount(0);

  const surface = page.getByTestId('remote-surface');
  await expect(surface).toHaveAttribute('data-live', 'true');
  expect(await page.evaluate(() => window.__tmRemote.level())).toBe('full');

  // the strips are big targets in the thumb zone, below the pad
  const pad = (await surface.boundingBox())!;
  const left = (await page.getByTestId('remote-strip-left').boundingBox())!;
  expect(left.y).toBeGreaterThan(pad.y + pad.height - 1);
  expect(left.height).toBeGreaterThanOrEqual(44);
  expect(pad.height).toBeGreaterThan(200);

  // one finger slides: the pointer moves by as much
  const x = pad.x + pad.width / 2;
  const y = pad.y + pad.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 20, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__tmRemote.pointed().reduce((sum, p) => [sum[0]! + p.dx, sum[1]! + p.dy], [0, 0]),
      ),
    )
    .toEqual([40, 20]);

  // a tap is a click
  await surface.click();
  await expect
    .poll(() => page.evaluate(() => window.__tmRemote.sent()))
    .toEqual(['left-down', 'left-up']);

  // "Links" is down exactly as long as the strip is held
  await page.mouse.move(left.x + left.width / 2, left.y + left.height / 2);
  await page.mouse.down();
  await expect.poll(() => page.evaluate(() => window.__tmRemote.sent().length)).toBe(3);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.__tmRemote.sent().slice(2)))
    .toEqual(['left-down', 'left-up']);

  // a mouse session carries Medien too
  await page.getByRole('button', { name: 'Medien' }).click();
  await page.getByTestId('remote-volume-up').click();
  await expect(state).toHaveText('Dein PC · Lautstärke 44 %');

  // the legend does not come back
  await page.getByRole('button', { name: 'Touchpad' }).click();
  await expect(page.getByTestId('remote-surface')).toBeVisible();
  await expect(page.getByTestId('remote-legend')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('remote-5-touchpad.png') });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('touchpad: every reason it stays still has its sentence and one step', async ({
  page,
}, info) => {
  // the PC grants media only: the sentence at once, no prompt, and the way back
  await asPhoneWithRemote(page);
  await page.goto('/remote');
  await expect(page.getByTestId('remote-state')).toHaveText('Dein PC · Lautstärke 42 %');
  await page.getByRole('button', { name: 'Touchpad' }).click();
  const state = page.getByTestId('remote-state');
  await expect(state).toContainText('Maus und Tastatur sind am PC für dieses Handy aus.');
  await expect(page.getByTestId('remote-surface')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('remote-strip-left')).toBeDisabled();
  expect(await page.evaluate(() => window.__tmRemote.unlocks())).toBe(0);
  await page.screenshot({ path: info.outputPath('remote-6-touchpad-not-granted.png') });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.getByTestId('remote-to-media').click();
  await expect(page.getByTestId('remote-play-pause')).toBeVisible();
});

test('touchpad: a dismissed unlock keeps Medien and asks again only on "Entsperren"', async ({
  page,
}) => {
  await asPhoneWithRemote(page, 'full:unlock');
  await page.goto('/remote');
  await expect(page.getByTestId('remote-state')).toHaveText('Dein PC · Lautstärke 42 %');
  await page.evaluate(() => window.__tmRemote.setUnlock('cancel'));
  await page.getByRole('button', { name: 'Touchpad' }).click();
  const state = page.getByTestId('remote-state');
  await expect(state).toContainText('Maus und Tastatur brauchen einmal dein Entsperren.');
  expect(await page.evaluate(() => window.__tmRemote.unlocks())).toBe(1);
  // Medien goes on meanwhile
  await page.getByRole('button', { name: 'Medien' }).click();
  await page.getByTestId('remote-volume-up').click();
  await expect(page.getByTestId('remote-state')).toHaveText('Dein PC · Lautstärke 44 %');
  // back on the pad nothing asks by itself
  await page.getByRole('button', { name: 'Touchpad' }).click();
  await expect(state).toContainText('Maus und Tastatur brauchen einmal dein Entsperren.');
  expect(await page.evaluate(() => window.__tmRemote.unlocks())).toBe(1);
  await page.evaluate(() => window.__tmRemote.setUnlock('ok'));
  await page.getByTestId('remote-unlock').click();
  await expect(page.getByTestId('remote-surface')).toHaveAttribute('data-live', 'true');
  expect(await page.evaluate(() => window.__tmRemote.unlocks())).toBe(2);

  // the PC is locked at the PC: the pad goes still and says so
  await page.evaluate(() => window.__tmRemote.setState({ locked: true } as never));
  await expect(state).toContainText('PC ist gesperrt. Medien und Lautstärke gehen weiter.');
  await expect(page.getByTestId('remote-surface')).toHaveAttribute('data-live', 'false');
});

test('touchpad: the strips reach the thumb zone upright, and sideways the pad fills the screen', async ({
  page,
}, info) => {
  await asPhoneWithRemote(page, 'full');
  await page.goto('/remote');
  await expect(page.getByTestId('remote-state')).toHaveText('Dein PC · Lautstärke 42 %');
  await page.getByRole('button', { name: 'Touchpad' }).click();
  await page.getByTestId('remote-legend-close').click();
  const surface = page.getByTestId('remote-surface');
  await expect(surface).toHaveAttribute('data-live', 'true');

  // upright: nothing to scroll, the strips end just above the layout's own bottom room
  const upright = await page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight - window.innerHeight,
    main: document.querySelector('main')!.getBoundingClientRect().bottom,
    pad: getComputedStyle(document.querySelector('main')!).paddingBottom,
  }));
  const strip = (await page.getByTestId('remote-strip-left').boundingBox())!;
  info.annotations.push({ type: 'layout', description: JSON.stringify({ upright, strip }) });
  expect(upright.scroll).toBeLessThanOrEqual(1);
  await page.screenshot({ path: info.outputPath('remote-7-touchpad-upright.png') });

  // sideways: pad and strips side by side; scrolled into view the pad takes the screen's height
  await page.setViewportSize({ width: 915, height: 412 });
  await page.getByTestId('remote-strip-right').scrollIntoViewIfNeeded();
  const pad = (await surface.boundingBox())!;
  const left = (await page.getByTestId('remote-strip-left').boundingBox())!;
  const right = (await page.getByTestId('remote-strip-right').boundingBox())!;
  expect(left.x).toBeGreaterThan(pad.x + pad.width - 1);
  expect(right.y).toBeGreaterThan(left.y + left.height - 1);
  expect(pad.height).toBeGreaterThan(130);
  expect(left.height).toBeGreaterThanOrEqual(44);
  expect(right.height).toBeGreaterThanOrEqual(44);
  // both strips and the whole pad are on the screen at once
  expect(right.y + right.height).toBeLessThanOrEqual(412);
  expect(pad.y + pad.height).toBeLessThanOrEqual(412);
  await page.screenshot({ path: info.outputPath('remote-8-touchpad-landscape.png') });
});
