import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { dismissNotices } from '../helpers';
import { test } from './helpers';
import { DESKTOP, PHONE } from './guards';

/**
 * Answering a planned mail from its row (planner hub 2, package 4c, hand-off 04): a ToDo made from a mail lies on today's
 * sheet. Expanded, mail's panel shows sender, subject and the newest message's text from the cache, the ToDo's own
 * checklist under it; „Antworten“ opens mail's compose window over the planner – nothing is sent, the planner is never
 * left. Plus the open compartment in an axe pass. The demo mailbox, invented rows only.
 */
const TODAY = '2026-11-30'; // Monday
const base = { createdAt: 1, updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };

const laid = (itemKey: string, order: number) => ({
  id: `${itemKey}#0`,
  itemKey,
  k: 0,
  of: 1,
  date: TODAY,
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

/** `desktop`: the faked desktop app (mail exists only there); `web`: a device without mail, as the phone. */
async function prepare(page: Page, kind: 'desktop' | 'web' = 'desktop') {
  await page.addInitScript((k) => localStorage.setItem('__tmPlatformKind', k), kind);
  await page.clock.setFixedTime(new Date(`${TODAY}T09:00:00`));
  await dismissNotices(page);
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  const from = { name: 'Anna Beispiel', email: 'anna@example.org' };
  await put(page, {
    _modules: ['planner', 'todos', 'mail'].map((id) => ({ id, enabled: true, dataPolicy: null })),
    todos_list: [{ id: 'inbox', name: 'Eingang', order: 0 }],
    mail_thread: [
      {
        id: 'demo|t1',
        accountKey: 'demo',
        threadId: 't1',
        sortKey: 1_796_000_000_000,
        unread: true,
        inbox: true,
        demo: {
          from,
          subject: 'Treffen am Samstag?',
          snippet: 'Hast du Zeit?',
          messageCount: 1,
          hasAttachment: false,
          labelIds: ['INBOX'],
          personal: true,
        },
      },
    ],
    mail_body: [
      {
        id: 'demo|m1',
        accountKey: 'demo',
        messageId: 'm1',
        threadId: 't1',
        sortKey: 1,
        demo: {
          from,
          to: [{ email: 'test@example.org' }],
          subject: 'Treffen am Samstag?',
          date: 1_796_000_000_000,
          text: 'Hallo,\nhast du am Samstag Zeit für einen Kaffee?\nAnna',
        },
      },
    ],
    todos_task: [
      {
        id: 'mt',
        listId: 'inbox',
        title: 'Anna Beispiel · Treffen am Samstag?',
        done: false,
        priority: 0,
        order: 0,
        estimateMin: 15,
        links: [{ kind: 'mail', id: 't1', label: 'Treffen am Samstag?' }],
        checklist: [{ id: 'c1', text: 'Kalender prüfen', done: false }],
      },
    ],
    planner_assignment: [laid('todos:mt', 0)],
  });
  await page.goto('/planner');
  await expect(page.locator('main h1')).toBeVisible();
}

const open = async (page: Page) => {
  const row = page.locator('[data-row-key="todos:mt"]').first();
  await row.locator('button[data-row]').first().click();
  const box = row.getByTestId('row-compartment');
  await expect(box).toBeVisible();
  return box;
};

test('a planned mail: its text in the row, „Antworten“ over the planner, nothing sent', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize(DESKTOP);
  await prepare(page);
  const box = await open(page);
  await expect(box).toContainText('Treffen am Samstag?');
  await expect(box.getByTestId('mail-plan-body')).toContainText('Kaffee');
  await expect(box.getByRole('checkbox', { name: '„Kalender prüfen“ abhaken' })).toBeVisible();
  await box.getByRole('button', { name: 'Antworten', exact: true }).click();
  const compose = page.getByRole('dialog', { name: 'Antworten' });
  await expect(compose).toBeVisible();
  await expect(page).toHaveURL(/\/planner/);
  await compose.getByRole('button', { name: 'Verwerfen' }).click();
  await expect(compose).toHaveCount(0);
  await expect(page.getByTestId('mail-pending')).toHaveCount(0);
});

for (const scheme of ['light', 'dark'] as const)
  test(`a planned mail’s compartment passes axe (${scheme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: scheme });
    await prepare(page);
    const box = await open(page);
    await expect(box.getByTestId('mail-plan-body')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
  });

test('a device without mail (the phone): X5 and X6 in the row, no button; the checklist stays', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize(PHONE);
  await prepare(page, 'web');
  const box = await open(page);
  await expect(box).toContainText('Mails beantwortest du am PC.');
  await expect(box.getByRole('button', { name: 'Antworten' })).toHaveCount(0);
  await expect(box.getByRole('checkbox', { name: '„Kalender prüfen“ abhaken' })).toBeVisible();
});
