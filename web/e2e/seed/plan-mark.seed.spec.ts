import { expect, type Page } from '@playwright/test';
import { dismissNotices } from '../helpers';
import { test } from './helpers';
import { DESKTOP, PHONE } from './guards';

/**
 * The mark „Im Plan · Mi“ (planner hub 2, package 10b, hand-off 10): an invoice, a list, a note (through its plan
 * ToDo), a subscription (an occurrence the planner laid) and a Merkliste entry, all placed on Wednesday, show M1 in
 * their own module – and the mark lands on the plan row it matched: the subscription on its occurrence row, the note
 * on its carrier ToDo's row. Rechnungen and Abos carry the mark in their detail only (their lists broke the stimulus
 * budget with it), so they are opened with `?open=`. Invented rows only (no seed data needed).
 */
const TODAY = '2026-11-30'; // Monday
const WEDNESDAY = '2026-12-02';
const base = { createdAt: 1, updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };

const THINGS = [
  { path: '/invoices?open=i3', title: 'Musikschule Beispiel', rowKey: 'invoices:i3' },
  { path: '/lists', title: 'Einkauf', rowKey: 'lists:shopping-default' },
  { path: '/notes', title: 'Regal im Flur', rowKey: 'todos:nt' },
  {
    path: '/subscriptions?open=s1',
    title: 'Streamingdienst Beispiel',
    rowKey: 'subscriptions:s1:2026-12-03',
  },
  { path: '/bookmarks', title: 'Fahrradträger', rowKey: 'bookmarks:bm1' },
];

const laid = (itemKey: string, order: number) => ({
  id: `${itemKey}#0`,
  itemKey,
  k: 0,
  of: 1,
  date: WEDNESDAY,
  minutes: 20,
  order,
  reason: 'new',
});

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
            for (const r of rows) tx.objectStore(store).put({ ...base, ...r });
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
    _modules: ['todos', 'planner', 'invoices', 'subscriptions', 'lists', 'notes', 'bookmarks'].map(
      (id) => ({ id, enabled: true, dataPolicy: null }),
    ),
    todos_list: [{ id: 'inbox', name: 'Eingang', order: 0 }],
    invoices_invoice: [
      {
        id: 'i3',
        payee: 'Musikschule Beispiel',
        amountMinor: 4500,
        dueDate: '2026-12-09',
        status: 'open',
      },
    ],
    subscriptions_subscription: [
      {
        id: 's1',
        name: 'Streamingdienst Beispiel',
        amountMinor: 1299,
        startDate: '2026-01-10',
        recurrence: { freq: 'monthly', interval: 1 },
        cancelNoticeDays: 7,
        active: true,
      },
    ],
    lists_list: [{ id: 'shopping-default', name: 'Einkauf', kind: 'shopping', order: 0 }],
    lists_item: ['Milch', 'Spülmittel', 'Batterien AA'].map((name, i) => ({
      id: `s${i}`,
      listId: 'shopping-default',
      name,
      done: false,
      order: i,
    })),
    notes_note: [{ id: 'n1', title: 'Regal im Flur', body: 'Maße nehmen.', pinned: false }],
    todos_task: [
      {
        id: 'nt',
        listId: 'inbox',
        title: 'Regal im Flur',
        done: false,
        priority: 0,
        order: 0,
        estimateMin: 20,
        links: [{ kind: 'note', id: 'n1', label: 'Regal im Flur' }],
      },
    ],
    bookmarks_item: [
      {
        id: 'bm1',
        title: 'Fahrradträger',
        url: 'https://example.org/fahrradtraeger',
        kind: 'try',
        tags: [],
        done: false,
        started: false,
        inPlan: true,
      },
    ],
    planner_item: [
      {
        id: 'lists:shopping-default',
        source: { module: 'lists', id: 'shopping-default' },
        order: 0,
      },
    ],
    planner_assignment: THINGS.map((x, i) => laid(x.rowKey, i)),
  });
}

for (const [name, viewport, mobile] of [
  ['desktop', DESKTOP, false],
  ['phone', PHONE, true],
] as const) {
  test.describe(`plan mark everywhere (10b), ${name}`, () => {
    test.use({ viewport, isMobile: mobile, hasTouch: mobile });
    test.setTimeout(120_000);

    test('five things placed on Wednesday show „Im Plan · Mi“ and land on their own plan row', async ({
      page,
    }) => {
      await prepare(page);
      for (const thing of THINGS) {
        await page.goto(thing.path);
        await expect(page.locator('main h1')).toBeVisible();
        // In the page, or in the detail dialog the page opened (`?open=`).
        const scope = thing.path.includes('?open=')
          ? page.getByRole('dialog')
          : page.locator('main');
        const mark = scope
          .getByRole('link', { name: /^Im Plan · Mi – Mittwoch, 2\. Dezember\. Im Planer zeigen$/ })
          .first();
        await expect(mark, thing.path).toBeVisible();
        await expect(mark, thing.path).toHaveText('Im Plan · Mi');
        // Never inside the row's own button: one link of its own.
        await expect(mark.locator('xpath=ancestor::button'), thing.path).toHaveCount(0);
        await mark.click();
        await expect(page, thing.path).toHaveURL(/\/planner/);
        const row = page.locator(`[data-row-key="${thing.rowKey}"]`).first();
        await expect(row, thing.path).toBeVisible();
        await expect(row.locator('[data-row]').first(), thing.path).toBeFocused();
      }
    });

    test('M3: a thing asked in without a day lands under „Noch ohne Tag“, which unfolds', async ({
      page,
    }) => {
      await prepare(page);
      // The shopping list loses its day: it is asked in (its item row), so its mark reads M3.
      await put(page, {
        planner_assignment: [{ ...laid('lists:shopping-default', 0), deletedAt: 2 }],
      });
      await page.goto('/lists');
      const mark = page
        .locator('main')
        .getByRole('link', { name: /^Im Plan · noch ohne Tag/ })
        .first();
      await expect(mark).toBeVisible();
      await mark.click();
      await expect(page).toHaveURL(/\/planner/);
      const head = page.getByRole('button', { name: /^Noch ohne Tag (aus|ein)klappen$/ });
      await expect(head).toHaveAttribute('aria-expanded', 'true');
      await expect(
        page.locator('[data-row-key="lists:shopping-default"] [data-row]').first(),
      ).toBeFocused();
    });
  });
}
