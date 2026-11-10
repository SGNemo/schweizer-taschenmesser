import { expect, test } from '@playwright/test';

/**
 * Settings → Verbindungen → Fernsteuerung on the desktop app. The real thing lives in the native
 * shell (Rust tests in `src-tauri`); here the E2E build's stand-in (`core/platform/fakeRemoteHost.ts`)
 * answers, switched on per page. The "Windows dialog" is the fake's `answer` hook.
 */
interface Hooks {
  addDevice(name: string): string;
  answer(next: 'allow' | 'cancel'): void;
  asked(): number;
  open(id: string, level?: 'media' | 'full'): boolean;
}
declare global {
  interface Window {
    __tmRemoteHost: Hooks;
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tm-e2e-remotehost', '1');
    localStorage.setItem('__tmPlatformKind', 'desktop');
    // a preview section: listed with "In Arbeit anzeigen"
    localStorage.setItem('tm-show-preview', '1');
  });
});

test('allow a phone media control, see it control, end it, and find it paused', async ({
  page,
}, info) => {
  await page.goto('/settings/verbindungen');
  const section = page.getByTestId('remote-host');
  await expect(section).toBeVisible();
  const id = await page.evaluate(() => window.__tmRemoteHost.addDevice('Pixel 7'));

  // off first: the choice is there but inactive, with one sentence
  const master = section.getByRole('switch', { name: 'Fernsteuerung erlauben' });
  await expect(master).toHaveAttribute('aria-checked', 'false');
  const level = section.getByTestId('remote-level');
  await expect(level).toBeDisabled();
  await expect(section.getByTestId('remote-hint')).toContainText('Schalte oben');
  await section.screenshot({ path: info.outputPath('remote-1-off.png') });

  await master.click();
  await expect(master).toHaveAttribute('aria-checked', 'true');
  await expect(level).toBeEnabled();

  // "Abbrechen" in the Windows dialog: nothing changes, nothing is reported
  await page.evaluate(() => window.__tmRemoteHost.answer('cancel'));
  await level.selectOption('media');
  await expect(level).toHaveValue('off');
  await expect(section.getByTestId('remote-note')).toHaveCount(0);

  await page.evaluate(() => window.__tmRemoteHost.answer('allow'));
  await level.selectOption('media');
  await expect(level).toHaveValue('media');
  expect(await page.evaluate(() => window.__tmRemoteHost.asked())).toBe(2);

  // no chip while nobody controls
  await expect(page.getByTestId('remote-chip')).toHaveCount(0);
  expect(await page.evaluate((d) => window.__tmRemoteHost.open(d), id)).toBe(true);
  await expect(section.getByTestId('remote-controlling')).toContainText(
    'Pixel 7 steuert gerade Medien und Lautstärke',
  );
  await expect(page.getByTestId('remote-chip')).toHaveText('Fernsteuerung: Pixel 7');
  await section.screenshot({ path: info.outputPath('remote-2-controlling.png') });

  await section.getByTestId('remote-end').click();
  await expect(section.getByTestId('remote-controlling')).toHaveCount(0);
  await expect(page.getByTestId('remote-chip')).toHaveCount(0);
  await expect(section.getByTestId('remote-note')).toHaveText('Beendet. Pixel 7 ist pausiert.');
  await expect(section.getByTestId('remote-device')).toContainText('Pausiert');
  expect(await page.evaluate((d) => window.__tmRemoteHost.open(d), id)).toBe(false);
  await section.screenshot({ path: info.outputPath('remote-3-paused.png') });

  // paused: one step only, no choice next to it
  await expect(section.getByTestId('remote-level')).toHaveCount(0);
  await section.getByTestId('remote-resume').click();
  await expect(section.getByTestId('remote-resume')).toHaveCount(0);
  await expect(section.getByTestId('remote-level')).toHaveValue('media');
  expect(await page.evaluate((d) => window.__tmRemoteHost.open(d), id)).toBe(true);
});

test('a phone never sees the section', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'android'));
  await page.goto('/settings/verbindungen');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('remote-host')).toHaveCount(0);
});
