import { expect, test, type Page } from '@playwright/test';
import { showPreview } from './helpers';

// Preview modules, tools, connectors and sections are listed only with "In Arbeit anzeigen" (maturity).
test.beforeEach(({ page }) => showPreview(page));

/** Both tools are off by default: switch one on in the library, then open it from the toolbar. */
async function openTool(page: Page, id: string, name: string) {
  await page.goto('/tools');
  const card = page.getByTestId(`tool-${id}`);
  await expect(card.getByLabel(`${name} einschalten`)).not.toBeChecked();
  await card.getByLabel(`${name} einschalten`).click();
  await expect(card.getByLabel(`${name} einschalten`)).toBeChecked();
  await page.getByRole('button', { name: 'Werkzeuge' }).first().click();
  await page
    .getByRole('dialog', { name: 'Werkzeuge' })
    .getByRole('button', { name, exact: true })
    .click();
  return page.getByRole('dialog');
}

test.describe('Textvergleich', () => {
  test('compares two texts, counts changed lines and copies a unified diff', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const sheet = await openTool(page, 'diff', 'Textvergleich');
    await sheet.getByLabel('Vorher').fill('eins\nzwei\ndrei');
    await sheet.getByLabel('Nachher').fill('eins\nzwei  \nvier drei');
    await expect(sheet.getByTestId('diff-count')).toHaveText('2 Zeilen geändert');
    await expect(
      sheet.getByTestId('diff-rows').locator('li[data-kind="add"]').first(),
    ).toContainText('hinzugefügt');

    await sheet.getByLabel('Leerraum ignorieren').check();
    await expect(sheet.getByTestId('diff-count')).toHaveText('1 Zeile geändert');

    await sheet.getByRole('button', { name: 'Als Unified Diff kopieren' }).click();
    await expect(page.getByText('Unified Diff kopiert.')).toBeVisible();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain('--- a\n+++ b\n@@ ');
    expect(clip).toContain('-drei\n+vier drei');
  });

  test('shows a notice instead of freezing on a huge input', async ({ page }) => {
    const sheet = await openTool(page, 'diff', 'Textvergleich');
    await sheet.getByLabel('Vorher').fill('x'.repeat(20_001));
    await expect(sheet.getByTestId('diff-too-long')).toBeVisible();
  });
});

test.describe('Regex-Tester', () => {
  test('lists matches with groups, highlights them and previews a replacement', async ({
    page,
  }) => {
    const sheet = await openTool(page, 'regex', 'Regex-Tester');
    await sheet.getByTestId('regex-pattern').fill('(?<tag>[a-z]+)(\\d)');
    await sheet.getByTestId('regex-text').fill('ab1 cd2');
    await expect(sheet.getByTestId('regex-count')).toHaveText('2 Treffer');
    await expect(sheet.getByTestId('regex-hits')).toContainText('Gruppe 1, Gruppe „tag“');
    await expect(sheet.getByTestId('regex-highlight').locator('mark')).toHaveCount(2);

    await sheet.getByTestId('regex-replacement').fill('$2$<tag>');
    await expect(sheet.getByTestId('regex-replaced')).toHaveText('1ab 2cd');

    await sheet.getByLabel(/^g – /).uncheck();
    await expect(sheet.getByTestId('regex-count')).toHaveText('1 Treffer');
  });

  test('reports an invalid pattern', async ({ page }) => {
    const sheet = await openTool(page, 'regex', 'Regex-Tester');
    await sheet.getByTestId('regex-pattern').fill('(');
    await sheet.getByTestId('regex-text').fill('x');
    await expect(sheet.getByTestId('regex-invalid')).toContainText('Das Muster ist nicht gültig.');
  });

  test('stops a catastrophic pattern after one second and stays usable', async ({ page }) => {
    const sheet = await openTool(page, 'regex', 'Regex-Tester');
    await sheet.getByTestId('regex-pattern').fill('(a+)+$');
    await sheet.getByTestId('regex-text').fill('a'.repeat(40) + 'b');
    await expect(sheet.getByTestId('regex-timeout')).toContainText('Muster zu aufwendig', {
      timeout: 6000,
    });
    // The page did not hang: a harmless pattern answers right away.
    await sheet.getByTestId('regex-pattern').fill('a+');
    await expect(sheet.getByTestId('regex-count')).toHaveText('1 Treffer');
  });
});
