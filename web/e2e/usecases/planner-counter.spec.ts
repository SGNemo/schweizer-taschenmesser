import { expect, test, type Locator, type Page } from '@playwright/test';
import { ready, showPreview } from '../helpers';

/**
 * The counter-scenarios of the planner rethink (CONCEPT §7), package 6: nothing is spread by itself any more, so
 * each scene pays at most what the concept allows – and nothing lands on a day before the person taps.
 *  - First morning („Wochenende“ A–C): „Tage einteilen“, its last step the proposal, „Übernehmen“ – equal (≤ 7 taps).
 *  - „Kopf leer“: a dumped pile waits without a day; „Woche vorschlagen“ → „Übernehmen“ – +2 taps.
 *  - Reminder chain (invoice → deadline → pay): the chip „Vorschlag: Do · Frist Fr“, one tap – +1 tap.
 */

/** Monday 2026-11-16, 9:00. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-16T09:00:00'));
  await showPreview(page);
});

async function put(page: Page, table: string, record: Record<string, unknown>) {
  await page.evaluate(
    ({ name, rec }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(name, 'readwrite');
          tx.objectStore(name).put({
            createdAt: 1,
            updatedAt: 1,
            deviceId: 'e2e',
            deletedAt: null,
            _f: {},
            ...rec,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { name: table, rec: record },
  );
}

/** Planner, ToDos and invoices on; the given ToDos without a day (`[title, minutes]`). */
async function prepare(page: Page, todos: readonly (readonly [string, number])[] = []) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  for (const id of ['todos', 'planner', 'invoices'])
    await put(page, '_modules', { id, enabled: true, dataPolicy: null });
  await put(page, 'todos_list', { id: 'inbox', name: 'Eingang', order: 0 });
  for (const [i, [title, min]] of todos.entries())
    await put(page, 'todos_task', {
      id: `pile-${i}`,
      listId: 'inbox',
      title,
      done: false,
      priority: 0,
      order: i,
      estimateMin: min,
      createdAt: i + 1,
    });
}

/** Rows of the planner by ToDo or invoice id: the days things lie on. */
async function rowDays(page: Page): Promise<Record<string, string>> {
  return page.evaluate(
    () =>
      new Promise<Record<string, string>>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db
            .transaction('planner_assignment')
            .objectStore('planner_assignment')
            .getAll();
          req.onsuccess = () => {
            db.close();
            resolve(
              Object.fromEntries(
                (req.result as { itemKey: string; date: string; deletedAt: unknown }[])
                  .filter((r) => !r.deletedAt)
                  .map((r) => [r.itemKey.split(':')[1]!, r.date]),
              ),
            );
          };
          req.onerror = () => reject(req.error);
        };
      }),
  );
}

class Taps {
  n = 0;
  constructor(private page: Page) {}
  async tap(target: Locator) {
    this.n += 1;
    await target.click();
  }
}

test.describe('planner rethink, counter-scenarios (CONCEPT §7)', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(
      isMobile,
      'the tap counts are taken on the desktop (the phone opens „Noch ohne Tag“ once more)',
    );
  });

  test('first morning: „Tage einteilen“ ends with the same proposal – what waited gets a day too; ≤ 7 taps', async ({
    page,
  }) => {
    await prepare(page, [['Steuer', 60]]);
    await ready(page, '/planner');
    const taps = new Taps(page);
    await taps.tap(page.getByRole('button', { name: 'Weitere Optionen', exact: true }).first());
    await taps.tap(page.getByRole('menuitem', { name: 'Tage einteilen' }));
    const sheet = page.getByRole('dialog', { name: 'Tage einteilen' });
    await sheet
      .getByRole('textbox', { name: 'Eine Zeile je Ding' })
      .fill('Bude aufräumen\nDuschen');
    await taps.tap(sheet.getByRole('button', { name: 'Weiter' }));
    await taps.tap(sheet.getByRole('button', { name: 'Weiter' }));
    const preview = sheet.getByTestId('plan-preview');
    // The thing that waited without a day is part of the proposal (package 6).
    await expect(preview).toContainText('Steuer');
    expect(await rowDays(page)).toEqual({});
    await taps.tap(preview.getByRole('button', { name: 'Übernehmen' }));
    await expect(sheet).toHaveCount(0);
    await expect.poll(async () => Object.keys(await rowDays(page)).length).toBe(3);
    expect(taps.n).toBeLessThanOrEqual(7);
  });

  test('„Kopf leer“: the pile waits without a day – „Woche vorschlagen“, „Übernehmen“: two taps', async ({
    page,
  }) => {
    const pile = [
      ['Arbeitszeit eintragen', 15],
      ['Mails beantworten', 30],
      ['Bude aufräumen', 60],
      ['Pfand wegbringen', 20],
      ['Bericht lesen', 45],
    ] as const;
    await prepare(page, pile);
    await ready(page, '/planner');
    await expect(page.getByRole('heading', { name: /Noch ohne Tag/ })).toBeVisible();
    // Nothing was spread unasked.
    await page.waitForTimeout(800);
    expect(await rowDays(page)).toEqual({});
    const taps = new Taps(page);
    await taps.tap(page.getByTestId('suggest-week'));
    const preview = page.getByTestId('plan-preview');
    await expect(preview).toContainText('Vorschlag – noch ist nichts verschoben.');
    expect(await rowDays(page)).toEqual({});
    await taps.tap(preview.getByRole('button', { name: 'Übernehmen' }));
    await expect.poll(async () => Object.keys(await rowDays(page)).length).toBe(pile.length);
    expect(taps.n).toBe(2);
    // The toast says what was done – never the preview's „noch ist nichts verschoben“.
    const toast = page.getByRole('status').filter({ hasText: 'Vorschlag übernommen' });
    await expect(toast).toBeVisible();
    await expect(toast).not.toContainText('noch ist nichts verschoben');
  });

  test('„Kopf leer“ with one thing too long for any day: „In Teile aufteilen …“ in the proposal', async ({
    page,
  }) => {
    await prepare(page, [['Keller ausräumen', 420]]);
    await ready(page, '/planner');
    await page.getByTestId('suggest-week').click();
    const preview = page.getByTestId('plan-preview');
    await expect(preview).toContainText('passt an keinen Tag am Stück');
    await preview.getByRole('button', { name: 'In Teile aufteilen: Keller ausräumen' }).click();
    await expect(preview).toContainText('Keller ausräumen in Teilen');
    await expect(preview).not.toContainText('passt an keinen Tag am Stück');
    await preview.getByRole('button', { name: 'Übernehmen' }).click();
    await expect.poll(async () => Object.keys(await rowDays(page)).length).toBe(1);
    // All parts lie on days; the thing is in parts („Teil 1/…“).
    await expect(page.getByText(/Teil 1\/\d/).first()).toBeVisible();
  });

  test('reminder chain: an invoice with a deadline gets the chip „Vorschlag: … · Frist Fr“ – one tap lays it', async ({
    page,
  }) => {
    await prepare(page);
    await put(page, 'invoices_invoice', {
      id: 'mahnung',
      payee: 'Stadtwerke',
      amountMinor: 9240,
      dueDate: '2026-11-20',
      status: 'open',
    });
    await ready(page, '/planner');
    const wait = page.locator('[data-group="wait"] h2').getByRole('button');
    if ((await wait.getAttribute('aria-expanded')) !== 'true') await wait.click();
    const chip = page.getByTestId('proposal-chip');
    await expect(chip).toContainText(/Vorschlag: \w+ · Frist Fr/);
    expect(await rowDays(page)).toEqual({});
    const taps = new Taps(page);
    await taps.tap(chip.getByRole('button', { name: /^Übernehmen:/ }));
    await expect.poll(async () => Object.keys(await rowDays(page))).toEqual(['mahnung']);
    expect(taps.n).toBe(1);
  });

  test('„Neues automatisch vorschlagen“ on: a thing without a deadline gets „Vorschlag: …“; off: none', async ({
    page,
  }) => {
    await prepare(page, [['Bude aufräumen', 60]]);
    await ready(page, '/planner');
    const wait = page.locator('[data-group="wait"] h2').getByRole('button');
    if ((await wait.getAttribute('aria-expanded')) !== 'true') await wait.click();
    await expect(page.getByText('Bude aufräumen')).toBeVisible();
    await expect(page.getByTestId('proposal-chip')).toHaveCount(0);
    await ready(page, '/settings/module/planner');
    await page.getByRole('switch', { name: 'Neues automatisch vorschlagen' }).click();
    await ready(page, '/planner');
    const wait2 = page.locator('[data-group="wait"] h2').getByRole('button');
    if ((await wait2.getAttribute('aria-expanded')) !== 'true') await wait2.click();
    // The chip is computed after the board has settled (one dry run, queued behind the planner's own run).
    await expect(page.getByTestId('proposal-chip')).toContainText(/^Vorschlag: \w+Übernehmen$/, {
      timeout: 15_000,
    });
    // A chip writes nothing.
    expect(await rowDays(page)).toEqual({});
  });
});

test.describe('planner rethink, counter-scenarios on the phone', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'phone');
  });

  test('„Kopf leer“ on the phone: open „Noch ohne Tag“, „Woche vorschlagen“, „Übernehmen“ – three taps', async ({
    page,
  }) => {
    // The phone keeps its stimulus bound (kopf-leer D): the link stands inside the open group – one tap more than
    // CONCEPT §7's +2 (named in the PR).
    await prepare(page, [
      ['Mails beantworten', 30],
      ['Bude aufräumen', 60],
    ]);
    await ready(page, '/planner');
    const taps = new Taps(page);
    const wait = page.locator('[data-group="wait"] h2').getByRole('button');
    // Folded by default (Q4 a): opening it is the first tap.
    await expect(wait).toHaveAttribute('aria-expanded', 'false');
    await taps.tap(wait);
    await taps.tap(page.getByTestId('suggest-week'));
    await taps.tap(page.getByTestId('plan-preview').getByRole('button', { name: 'Übernehmen' }));
    await expect.poll(async () => Object.keys(await rowDays(page)).length).toBe(2);
    expect(taps.n).toBe(3);
  });
});
