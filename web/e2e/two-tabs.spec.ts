import { expect, test } from '@playwright/test';
import { dismissNotices, ready } from './helpers';

/**
 * QA round 4, X01: two tabs edit the same to-do. The editor that opened first used to write back
 * every field as it was when it opened, so the title saved in the other tab was undone.
 */
test('saving in one tab keeps the title changed in the other tab', async ({ page, context }) => {
  await ready(page, '/todos?list=inbox');
  await page.locator('[data-page-action]:visible, [data-testid="bottom-plus"]:visible').click();
  await page.getByRole('dialog').getByLabel('Titel').fill('Steuererklärung');
  await page.getByRole('dialog').getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Steuererklärung' })).toBeVisible();
  await page.getByRole('button', { name: /Steuererklärung/ }).click();
  const editorA = page.getByRole('dialog');
  await expect(editorA.getByLabel('Titel')).toHaveValue('Steuererklärung');

  // Tab B: same to-do, new title, saved.
  const tabB = await context.newPage();
  await dismissNotices(tabB);
  await ready(tabB, '/todos?list=inbox');
  await tabB.getByRole('button', { name: /Steuererklärung/ }).click();
  await tabB.getByRole('dialog').getByLabel('Titel').fill('Steuern 2026');
  await tabB.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(tabB.getByRole('dialog')).toHaveCount(0);

  // Tab A (still open since before): change the priority only and save.
  await editorA.getByLabel('Priorität').selectOption({ label: 'Hoch' });
  await editorA.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await tabB.reload();
  await expect(tabB.getByRole('checkbox', { name: 'Steuern 2026' })).toBeVisible();
  await expect(tabB.getByRole('checkbox', { name: 'Steuererklärung' })).toHaveCount(0);
});
