import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/**
 * Settings → KI → Lokales Modell says what applies to this app (E2E builds fake the shell via
 * `localStorage.__tmPlatformKind` / `__tmLocalModel`; no real model is downloaded).
 */
async function pose(page: Page, kind: 'desktop' | null, model: 'ready' | 'build' | null) {
  await page.addInitScript(
    ([k, m]) => {
      if (k) localStorage.setItem('__tmPlatformKind', k);
      if (m) localStorage.setItem('__tmLocalModel', m);
    },
    [kind, model] as const,
  );
}

async function openSection(page: Page) {
  // A deep link opens the "Erweitert" fold the section may sit in.
  await ready(page, '/settings/ki#ai-local');
  const section = page.locator('section[aria-labelledby="ai-local"]');
  await expect(section).toBeInViewport();
  return section;
}

test('browser: no local model, no link to another download', async ({ page }) => {
  const section = await openSection(page);
  await expect(section.getByTestId('local-unavailable')).toHaveText(
    'Im Browser gibt es kein lokales Modell. In der Windows-App schon.',
  );
  await expect(section.getByTestId('local-get-stable')).toHaveCount(0);
});

test('desktop build without the model: says so and links the regular version', async ({ page }) => {
  await pose(page, 'desktop', 'build');
  const section = await openSection(page);
  await expect(section.getByTestId('local-unavailable')).toContainText(
    'Die normale Version von Nemo hat es',
  );
  await expect(section.getByTestId('local-get-stable')).toHaveText('Normale Version holen');
});

test('desktop with the model: next step goes from choice to download to test question', async ({
  page,
}) => {
  await pose(page, 'desktop', 'ready');
  const section = await openSection(page);
  const suggestions = section.getByTestId('local-suggestions');
  await expect(suggestions.getByRole('listitem')).toHaveCount(3);
  await expect(suggestions).toContainText('GB');
  await suggestions.getByRole('button').first().click();
  await page.getByTestId('local-consent-confirm').click();
  await expect(section.getByTestId('local-next-test')).toHaveText('Testfrage stellen');
  await expect(section.getByTestId('local-suggestions')).toHaveCount(0);
});
