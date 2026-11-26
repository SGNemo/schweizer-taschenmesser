import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { dismissNotices } from '../helpers';
import { test } from './helpers';
import { DESKTOP, PHONE } from './guards';

/**
 * Before and after an appointment (planner hub 2, package 9; hand-off 09): the appointment's blocker row opens on
 * calendar's panel (day · time · place) with the planner's „Vorbereiten …“ / „Danach …“; the lead chip A2 stands before
 * the field; Enter makes a ToDo on that day linked to the appointment, its row says A4 and stands right before / after
 * the blocker; the panel ticks it; a struck chip for another kind; A3 hidden for today's appointment; a deleted
 * appointment reads X3. Axe light and dark. Invented rows only.
 */
const TODAY = '2026-11-30'; // Monday
const base = { updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };
const MODULES = ['todos', 'planner', 'calendar', 'invoices'];
const WEDNESDAY = '2026-12-02';

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

async function prepare(page: Page) {
  await page.clock.setFixedTime(new Date(`${TODAY}T09:00:00`));
  await dismissNotices(page);
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await put(page, {
    _modules: MODULES.map((id) => ({ id, enabled: true, dataPolicy: null })),
    todos_list: [{ id: 'inbox', name: 'Eingang', order: 0 }],
    calendar_event: [
      {
        id: 'ev1',
        title: 'Friseur',
        allDay: false,
        startDate: WEDNESDAY,
        startTime: '15:00',
        endTime: '16:00',
        location: 'Salon am Markt',
      },
      { id: 'ev2', title: 'Zahnarzt', allDay: false, startDate: TODAY, startTime: '17:00' },
    ],
  });
  await page.goto('/planner');
  await expect(page.locator('main h1')).toBeVisible();
}

const field = (page: Page) => page.getByRole('textbox', { name: 'Eintragen oder sagen' });

async function openAppointment(page: Page, date: string, title: string) {
  const tile = page.getByTestId(`week-${date}`);
  if ((await tile.getAttribute('aria-pressed')) !== 'true') await tile.click();
  const sheet = page.getByTestId(`day-${date}`);
  await sheet
    .getByRole('button', { name: new RegExp(`^${title}`) })
    .first()
    .click();
  const panel = sheet.getByTestId('row-compartment');
  await expect(panel).toBeVisible();
  return { sheet, panel };
}

for (const [name, viewport, mobile] of [
  ['desktop', DESKTOP, false],
  ['phone', PHONE, true],
] as const) {
  test.describe(`before and after an appointment (9), ${name}`, () => {
    test.use({ viewport, isMobile: mobile, hasTouch: mobile });
    test.setTimeout(120_000);
    test('„Vorbereiten …“ and „Danach …“ make linked things beside the blocker; the panel ticks them', async ({
      page,
    }) => {
      await prepare(page);
      const { sheet, panel } = await openAppointment(page, WEDNESDAY, 'Friseur');
      await expect(panel.getByText(/15:00–16:00 · Salon am Markt/)).toBeVisible();
      await panel.getByRole('button', { name: 'Vorbereiten …' }).click();
      const chip = page.getByTestId('planner-lead');
      await expect(chip).toContainText('vor Friseur, Mi');
      await expect(field(page)).toBeFocused();
      await field(page).fill('Bargeld holen');
      await field(page).press('Enter');
      await expect(page.getByText('Liegt auf Mi, vor Friseur.')).toBeVisible();
      await expect(chip).toHaveCount(0);
      // „Danach …“ with A3: the day after.
      await panel.getByRole('button', { name: 'Danach …' }).click();
      await page.getByRole('button', { name: 'nach Friseur, Mi. Ändern' }).click();
      await page.getByRole('menuitemcheckbox', { name: 'am Tag danach' }).click();
      await expect(chip).toContainText('nach Friseur, Do');
      await field(page).fill('Föhn zurückgeben');
      await field(page).press('Enter');
      await expect(page.getByText('Liegt auf Do, nach Friseur.')).toBeVisible();
      // The row says A4 and stands right before the blocker on Wednesday.
      const titles = await sheet
        .locator('li')
        .evaluateAll((lis) =>
          lis.map((li) => (li as HTMLElement).innerText.split('\n')[0]?.trim() ?? ''),
        );
      const prep = titles.findIndex((x) => x.includes('Bargeld holen'));
      const appt = titles.findIndex((x) => x === 'Friseur');
      expect(prep).toBeGreaterThanOrEqual(0);
      expect(prep).toBe(appt - 1);
      await expect(sheet.getByText('vor Friseur', { exact: true })).toBeVisible();
      // The panel lists it under „Vorbereitung“ and ticks it.
      await expect(panel.getByText('Vorbereitung', { exact: true })).toBeVisible();
      await panel.getByRole('checkbox', { name: '„Bargeld holen“ abhaken' }).click();
      await expect.poll(async () => (await count(page, 'todos_task', true)).done).toBe(1);
    });
  });
}

/** Live rows of a store, and how many of them are done. */
async function count(page: Page, store: string, withDone = false) {
  return page.evaluate(
    ({ store, withDone }) =>
      new Promise<{ all: number; done: number }>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(store).objectStore(store).getAll();
          req.onsuccess = () => {
            db.close();
            const live = (req.result as { deletedAt: unknown; done?: boolean }[]).filter(
              (r) => r.deletedAt === null,
            );
            resolve({ all: live.length, done: withDone ? live.filter((r) => r.done).length : 0 });
          };
          req.onerror = () => reject(req.error);
        };
      }),
    { store, withDone },
  );
}

test('the chip: no „am Tag davor“ for today’s appointment; struck for another kind; X3 once the appointment is gone', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize(DESKTOP);
  await prepare(page);
  const { panel } = await openAppointment(page, TODAY, 'Zahnarzt');
  await panel.getByRole('button', { name: 'Vorbereiten …' }).click();
  const chip = page.getByTestId('planner-lead');
  await expect(chip).toContainText('vor Zahnarzt, Mo');
  // No earlier day to offer: the chip is no menu button, only ✕ beside it.
  await expect(chip.getByRole('button', { name: /Ändern$/ })).toHaveCount(0);
  await expect(chip.getByRole('button', { name: 'Entfernen' })).toBeVisible();
  // Another kind: struck, with A7 as its description, and not applied.
  await field(page).fill('Rechnung Salon 30 € bis Fr');
  await expect(page.getByTestId('planner-kind')).toContainText('Rechnung');
  await expect(chip.getByText('vor Zahnarzt, Mo – gilt nicht für Rechnung')).toBeAttached();
  // Backspace in the empty field takes the chip away.
  await field(page).fill('');
  await field(page).press('Backspace');
  await expect(chip).toHaveCount(0);
  // A thing made before the appointment, then the appointment deleted: the row's chip reads X3.
  await panel.getByRole('button', { name: 'Vorbereiten …' }).click();
  await field(page).fill('Zettel einpacken');
  await field(page).press('Enter');
  await expect(page.getByText(/^Liegt auf Mo, vor Zahnarzt\./)).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('calendar_event', 'readwrite');
          const store = tx.objectStore('calendar_event');
          const get = store.get('ev2');
          get.onsuccess = () => store.put({ ...get.result, deletedAt: 2 });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await expect(page.getByTestId(`day-${TODAY}`).getByText('Gibt es nicht mehr.')).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const)
  test(`before and after an appointment (9): panel and chip pass axe (${scheme})`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await prepare(page);
    const { panel } = await openAppointment(page, WEDNESDAY, 'Friseur');
    await panel.getByRole('button', { name: 'Vorbereiten …' }).click();
    await expect(page.getByTestId('planner-lead')).toBeVisible();
    const violations = (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`);
    expect(violations).toEqual([]);
  });
