import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { dismissNotices } from '../helpers';
import { test } from './helpers';
import { DESKTOP, PHONE } from './guards';

/**
 * Topic as a bracket (planner hub 2, package 11; hand-off 11): „Thema …“ on a row creates „Umzug“, the next row's ⋯ offers
 * „Thema: Umzug“ (T12); the page's ⋯ shows only that topic (T4 in the head, members only, an appointment without the
 * topic hidden); the field's chip T11 puts a new ToDo into it (K8); an invoice typed then ends with K9 and „Alles
 * zeigen“ ends the filter; the settings delete a topic (T9). Axe on the chooser and the filtered page. Invented rows.
 */
const TODAY = '2026-11-30'; // Monday
const base = { updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };
const MODULES = ['todos', 'planner', 'calendar', 'invoices'];

async function put(page: Page, rowsByStore: Record<string, Record<string, unknown>[]>) {
  await page.evaluate(
    ({ rowsByStore, base }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(Object.keys(rowsByStore), 'readwrite');
          for (const [store, rows] of Object.entries(rowsByStore))
            for (const r of rows) tx.objectStore(store).put({ createdAt: 1, ...base, ...r });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { rowsByStore, base },
  );
}

const task = (id: string, title: string) => ({
  id,
  title,
  listId: 'inbox',
  done: false,
  order: 0,
  priority: 0,
});
const laid = (itemKey: string, date: string, order: number) => ({
  id: `${itemKey}#0`,
  itemKey,
  k: 0,
  of: 1,
  date,
  minutes: 30,
  order,
  reason: 'new',
});

async function prepare(page: Page) {
  await page.clock.setFixedTime(new Date(`${TODAY}T09:00:00`));
  await dismissNotices(page);
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await put(page, {
    _modules: MODULES.map((id) => ({ id, enabled: true, dataPolicy: null })),
    todos_list: [{ id: 'inbox', name: 'Eingang', order: 0 }],
    todos_task: [
      task('a', 'Umzugskartons holen'),
      task('b', 'Strom ummelden'),
      task('c', 'Fenster putzen'),
    ],
    calendar_event: [
      { id: 'ev1', title: 'Zahnarzt', allDay: false, startDate: TODAY, startTime: '16:00' },
    ],
    planner_assignment: [
      laid('todos:a', TODAY, 0),
      laid('todos:b', TODAY, 1),
      laid('todos:c', TODAY, 2),
    ],
  });
  await page.goto('/planner');
  await expect(page.locator('main h1')).toBeVisible();
}

const sheet = (page: Page) => page.getByTestId(`day-${TODAY}`);
const menuOf = (page: Page, title: string) =>
  page.getByRole('button', { name: `Aktionen für ${title}`, exact: true }).first();

async function giveUmzug(page: Page) {
  await menuOf(page, 'Umzugskartons holen').click();
  await page.getByRole('menuitem', { name: 'Thema …', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Thema wählen oder neu eintippen' });
  await expect(
    chooser.getByText('Ein Thema hält Dinge aus mehreren Modulen zusammen.'),
  ).toBeVisible();
  const field = chooser.getByRole('combobox', { name: 'Thema' });
  await field.fill('Umzug');
  await field.press('Enter');
  await expect(chooser).toHaveCount(0);
  await expect(page.getByText('1 Ding gehört jetzt zu „Umzug“.')).toBeVisible();
  // T12: the next row offers the last used topic directly.
  await menuOf(page, 'Strom ummelden').click();
  await page.getByRole('menuitem', { name: 'Thema: Umzug', exact: true }).click();
  await expect(page.getByText('1 Ding gehört jetzt zu „Umzug“.').last()).toBeVisible();
}

async function filterUmzug(page: Page) {
  await page.getByRole('button', { name: 'Weitere Optionen', exact: true }).first().click();
  await page.getByRole('menuitem', { name: 'Nur ein Thema zeigen …', exact: true }).click();
  await page.getByRole('dialog').getByRole('option', { name: /Umzug/ }).first().click();
  await expect(page.getByTestId('planner-topic-head')).toContainText('Thema: Umzug');
}

for (const [name, viewport, mobile] of [
  ['desktop', DESKTOP, false],
  ['phone', PHONE, true],
] as const) {
  test.describe(`topic (11), ${name}`, () => {
    test.use({ viewport, isMobile: mobile, hasTouch: mobile });
    test.setTimeout(120_000);
    test('give a topic, show only it, add into it; another kind says it is not in it', async ({
      page,
    }) => {
      await prepare(page);
      await giveUmzug(page);
      await filterUmzug(page);
      await expect(page.getByTestId('planner-topic-head')).toContainText('2 Dinge');
      // Members only: „Fenster putzen“ and the appointment without the topic are hidden.
      await expect(sheet(page).getByText('Fenster putzen')).toHaveCount(0);
      await expect(sheet(page).getByText('Zahnarzt')).toHaveCount(0);
      await expect(sheet(page).getByText('Strom ummelden').first()).toBeVisible();
      // T11 before the field: a new ToDo goes into the topic (K8).
      await expect(page.getByTestId('planner-topic-chip')).toContainText('Thema: Umzug');
      const field = page.getByRole('textbox', { name: 'Eintragen oder sagen' });
      await field.fill('Helfer fragen');
      await field.press('Enter');
      await expect(page.getByText(/^Liegt auf Mo, in „Umzug“\./)).toBeVisible();
      await expect(sheet(page).getByText('Helfer fragen').first()).toBeVisible();
      // An invoice takes no topic: K9 and „Alles zeigen“ ends the filter.
      await field.fill('Rechnung Umzugsfirma 450 € bis Fr');
      await field.press('Enter');
      await expect(page.getByText('Nicht im Thema „Umzug“')).toBeVisible();
      await page.getByRole('button', { name: 'Alles zeigen' }).last().click();
      await expect(page.getByTestId('planner-topic-head')).toHaveCount(0);
      await expect(sheet(page).getByText('Fenster putzen').first()).toBeVisible();
    });
  });
}

test('the settings delete a topic (T9); a topic with nothing in the plan shows T6', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize(DESKTOP);
  await prepare(page);
  await giveUmzug(page);
  // Both members done: the topic is empty in the plan.
  for (const title of ['Umzugskartons holen', 'Strom ummelden'])
    await page
      .getByRole('checkbox', { name: `Erledigt: ${title}`, exact: true })
      .first()
      .click();
  await filterUmzug(page);
  await expect(page.getByTestId('planner-topic-empty')).toHaveText(
    'In diesem Thema liegt gerade nichts im Plan.',
  );
  await page.goto('/settings/module/planner');
  await expect(page.getByRole('heading', { name: 'Themen' })).toBeVisible();
  await page.getByRole('button', { name: 'Thema löschen … Umzug' }).click();
  const confirm = page.getByRole('dialog', { name: 'Thema löschen …' });
  await expect(confirm.getByText('Die Dinge bleiben, nur die Klammer geht.')).toBeVisible();
  await confirm.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('Thema „Umzug“ gelöscht.')).toBeVisible();
  await expect(page.getByText('Noch kein Thema.')).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const)
  test(`topic (11): the chooser and the filtered page pass axe (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await prepare(page);
    const axe = async () =>
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`);
    await menuOf(page, 'Umzugskartons holen').click();
    await page.getByRole('menuitem', { name: 'Thema …', exact: true }).click();
    await page.getByRole('combobox', { name: 'Thema' }).fill('Umz');
    expect(await axe()).toEqual([]);
    await page.getByRole('combobox', { name: 'Thema' }).fill('Umzug');
    await page.getByRole('combobox', { name: 'Thema' }).press('Enter');
    await filterUmzug(page);
    expect(await axe()).toEqual([]);
  });
