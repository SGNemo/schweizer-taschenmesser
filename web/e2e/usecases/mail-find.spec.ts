import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { ready, showPreview } from '../helpers';
import { buildMailbox, cacheRows, TARGETS, TODAY } from './mail-find.fixture';

/**
 * Use case „Mail finden“ (docs/design/mail-find/ANALYSIS.md): five things a person looks for in an invented
 * mailbox of about 300 mails (invoices, newsletters, authorities, work, private, threads, attachments). Each task
 * takes the path a person would take with the page as it is: search first; when the search finds nothing,
 * that is a detour and the person reads the list from the top. Counted: steps (Handgriffe: a tap, a typed word,
 * Enter), typed characters, rows read until the last target, detours. The table lands in
 * `test-results/usecase-mail-find.md` and as the attachment `usecase-mail-find`.
 *
 * The mailbox is written as demo rows of the mail cache (account `demo`), so the run needs no Google login and is
 * the „offline / on this device“ case. What the search at Gmail would find is in the analysis, not measured here.
 * Mail is a desktop-only module: the page poses as the desktop app, at 1920 and at 412 px wide.
 *   npx playwright test e2e/usecases/mail-find.spec.ts --project=desktop-chrome
 *
 * `MAX` holds the measured state (a later change may only lower it); `TARGET` holds the goal of the round: every
 * task reads at most half the rows of `IST`, and the spring invoice takes at most 3 steps.
 */

const OUT = 'test-results/usecase-mail-find';

type Metric = 'steps' | 'keys' | 'rows' | 'detours';
type Row = { task: string; width: number } & Record<Metric, number> & { found: boolean };

/** The first measurement (2026-11-23, `develop` before this round). */
// prettier-ignore
const IST: Record<string, Record<Metric, number>> = {
  'A Rechnung vom Frühjahr': { steps: 3, keys: 15, rows: 242, detours: 1 },
  'B Alles von einem Absender': { steps: 3, keys: 10, rows: 201, detours: 1 },
  'C Mail mit einem bestimmten Anhang': { steps: 3, keys: 11, rows: 99, detours: 1 },
  'D Wartet auf eine Antwort von mir': { steps: 1, keys: 0, rows: 29, detours: 0 },
  'E Diese Woche neu und wichtig': { steps: 0, keys: 0, rows: 15, detours: 0 },
};

/**
 * Upper bounds: the numbers as measured after package 2 („Wartet auf mich“, 2026-11-23). E costs one tap more than
 * IST (the queue entry) and reads 3 rows instead of 15.
 */
// prettier-ignore
const MAX: Record<string, Record<Metric, number>> = {
  'A Rechnung vom Frühjahr': { steps: 2, keys: 15, rows: 7, detours: 0 },
  'B Alles von einem Absender': { steps: 2, keys: 10, rows: 9, detours: 0 },
  'C Mail mit einem bestimmten Anhang': { steps: 2, keys: 11, rows: 1, detours: 0 },
  'D Wartet auf eine Antwort von mir': { steps: 1, keys: 0, rows: 9, detours: 0 },
  'E Diese Woche neu und wichtig': { steps: 1, keys: 0, rows: 3, detours: 0 },
};

/** Tasks that reached the goal: from now on the goal is enforced for them too. */
const REACHED = ['A', 'B', 'C', 'D', 'E'];

/** The goal of the round (ANALYSIS.md „Ziel“): half the rows, the invoice in 3 steps. */
// prettier-ignore
const TARGET: Record<string, Partial<Record<Metric, number>>> = Object.fromEntries(
  Object.entries(IST).map(([k, v]) => [k, { rows: Math.floor(v.rows / 2), ...(k.startsWith('A') ? { steps: 3 } : {}) }]),
);

class Meter {
  steps = 0;
  keys = 0;
  rows = 0;
  detours = 0;
  found = false;
  constructor(private page: Page) {}
  async tap(target: Locator) {
    this.steps += 1;
    await target.click();
  }
  /** A typed search counts as one step and every character; Enter is a step of its own. */
  async search(text: string) {
    const field = this.page
      .getByRole('searchbox', { name: 'Suchen' })
      .or(this.page.getByLabel('Suchen', { exact: true }));
    this.steps += 1;
    this.keys += text.length;
    await field.first().fill(text);
    this.steps += 1;
    await field.first().press('Enter');
  }
  detour() {
    this.detours += 1;
  }
  /**
   * Reads the visible list from the top until every target was seen: the rows read are the position of the last
   * target. A target that is not listed leaves `found` false and counts the whole list.
   */
  async read(targets: readonly string[]): Promise<boolean> {
    const ids = await listedIds(this.page);
    const positions = targets.map((t) => ids.indexOf(t));
    if (positions.some((p) => p < 0)) {
      this.found = false;
      return false;
    }
    this.rows += Math.max(...positions) + 1;
    this.found = true;
    return true;
  }
}

async function listedIds(page: Page): Promise<string[]> {
  // Wait until the list stopped loading (skeleton gone) before reading it.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  return page
    .locator('main [data-thread-id]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-thread-id') ?? ''));
}

async function openMailbox(page: Page) {
  await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00`));
  await page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'desktop'));
  await showPreview(page);
  await ready(page, '/');
  const rows = cacheRows(buildMailbox());
  await page.evaluate(
    (data) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction(['_modules', 'mail_thread', 'mail_body'], 'readwrite');
          tx.objectStore('_modules').put({
            id: 'mail',
            enabled: true,
            dataPolicy: null,
            createdAt: 1,
            updatedAt: 1,
            deviceId: 'e2e',
            deletedAt: null,
            _f: {},
          });
          for (const r of data.thread) tx.objectStore('mail_thread').put(r);
          for (const r of data.body) tx.objectStore('mail_body').put(r);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    rows,
  );
  await ready(page, '/mail');
  await expect(page.locator('main [data-thread-id]').first()).toBeVisible();
}

/** Search first; nothing found is a detour, then back to the inbox and read it from the top. */
async function searchOrRead(page: Page, m: Meter, query: string, targets: readonly string[]) {
  await m.search(query);
  await expect(
    page.getByTestId('mail-empty').or(page.locator('main [data-thread-id]').first()),
  ).toBeVisible();
  if (await m.read(targets)) return;
  m.detour();
  await m.tap(page.getByRole('button', { name: 'Suche beenden' }));
  await expect(page.locator('main [data-thread-id]').first()).toBeVisible();
  await m.read(targets);
}

/** One step into „Wartet auf mich“: the folder entry, or the folder select when the window is narrow. */
async function openQueue(page: Page, m: Meter) {
  const entry = page.getByTestId('mail-queue');
  if (await entry.isVisible()) await m.tap(entry);
  else {
    m.steps += 1;
    await page.getByLabel('Ordner').selectOption('view:waiting');
  }
  await expect(page.getByText('An dich, noch ohne Antwort')).toBeVisible();
  // The walk button is drawn with the queue's rows: the list on screen is the queue now.
  await expect(page.getByTestId('mail-queue-walk')).toBeVisible();
}

const TASKS: Record<string, (page: Page, m: Meter) => Promise<void>> = {
  'A Rechnung vom Frühjahr': (page, m) =>
    searchOrRead(page, m, 'Rechnung Wasser', [TARGETS.springInvoice]),
  'B Alles von einem Absender': (page, m) => searchOrRead(page, m, 'Pusteblume', TARGETS.sender),
  'C Mail mit einem bestimmten Anhang': (page, m) =>
    searchOrRead(page, m, 'Mietvertrag', [TARGETS.attachment]),
  // Package 2: „Wartet auf mich“ (folder entry beside the list, the folder select in a narrow window).
  'D Wartet auf eine Antwort von mir': async (page, m) => {
    await openQueue(page, m);
    await m.read(TARGETS.waiting);
  },
  'E Diese Woche neu und wichtig': async (page, m) => {
    await openQueue(page, m);
    await m.read(TARGETS.weekImportant);
  },
};

function writeTable() {
  const rows: Row[] = readdirSync(OUT)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')));
  const table = [
    '| Task | Width | Steps | Keys | Rows read | Detours | Found |',
    '|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.task} | ${r.width} | ${r.steps} | ${r.keys} | ${r.rows} | ${r.detours} | ${r.found ? 'yes' : 'no'} |`,
    ),
  ].join('\n');
  const tmp = `${OUT}/table.${process.pid}.tmp`;
  writeFileSync(tmp, `${table}\n`);
  renameSync(tmp, 'test-results/usecase-mail-find.md');
}

async function record(info: TestInfo, row: Row) {
  mkdirSync(OUT, { recursive: true });
  const file = `${OUT}/${row.task.slice(0, 1)}-${row.width}.json`;
  writeFileSync(`${file}.tmp`, JSON.stringify(row));
  renameSync(`${file}.tmp`, file);
  writeTable();
  await info.attach('usecase-mail-find', {
    body: JSON.stringify(row, null, 2),
    contentType: 'application/json',
  });
}

for (const width of [1920, 412]) {
  test.describe(`mail find at ${width} px`, () => {
    test.use({ viewport: { width, height: width > 1000 ? 1080 : 915 } });
    test.skip(
      ({ isMobile }) => isMobile,
      'mail is a desktop-only module; the width covers the narrow window',
    );
    for (const [task, run] of Object.entries(TASKS)) {
      test(task, async ({ page }, info) => {
        test.setTimeout(90_000);
        await openMailbox(page);
        const m = new Meter(page);
        await run(page, m);
        // MAIL_FIND_SHOTS=1: a picture of the screen at the end of each task (for the PR text, never for docs/).
        if (process.env.MAIL_FIND_SHOTS)
          await page.screenshot({
            path: `test-results/mail-find-shots/${task.slice(0, 1)}-${width}.png`,
          });
        const row: Row = {
          task,
          width,
          steps: m.steps,
          keys: m.keys,
          rows: m.rows,
          detours: m.detours,
          found: m.found,
        };
        await record(info, row);
        expect(m.found, `${task}: every target is listed`).toBe(true);
        for (const k of ['steps', 'keys', 'rows', 'detours'] as const)
          expect(row[k], `${task} ${k} (MAX)`).toBeLessThanOrEqual(MAX[task]![k]);
        // The goal is enforced once a package reached it (REACHED); until then it is the line to aim for.
        if (REACHED.includes(task.slice(0, 1)))
          for (const [k, v] of Object.entries(TARGET[task]!))
            expect(row[k as Metric], `${task} ${k} (TARGET)`).toBeLessThanOrEqual(v);
      });
    }
  });
}

test.describe('mail search accessibility', () => {
  for (const width of [1920, 412]) {
    test(`search, chips and both result parts pass axe at ${width} px`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, 'mail is a desktop-only module');
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: width > 1000 ? 1080 : 915 });
      await openMailbox(page);
      const m = new Meter(page);
      await m.search('Mietvertrag');
      await expect(page.getByText('Mietvertrag', { exact: true }).first()).toBeVisible();
      // the chips row shows while a search runs; the hit line names the attachment
      await expect(page.getByRole('group', { name: 'Filter für die Suche' })).toBeVisible();
      await expect(page.getByTestId('mail-hit-line')).toContainText(
        'Anhang: Mietvertrag_Nachtrag_2026.pdf',
      );
      const results = await new AxeBuilder({ page })
        // known finding of the shared GroupedList toggle (see e2e/seed/mail.seed.spec.ts)
        .disableRules(['label-content-name-mismatch'])
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        results.violations.map((v) => `${v.id}: ${v.help} ${v.nodes[0]?.target.join(' ')}`),
      ).toEqual([]);
    });
  }

  for (const width of [1920, 412]) {
    test(`the queue and its walk pass axe at ${width} px; „Erledigt“ moves on and can be undone`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, 'mail is a desktop-only module');
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: width > 1000 ? 1080 : 915 });
      await openMailbox(page);
      await openQueue(page, new Meter(page));
      const first = await listedIds(page);
      await page.getByTestId('mail-queue-walk').click();
      const bar = page.getByRole('group', { name: 'Durch „Wartet auf mich“ gehen' });
      await expect(bar).toContainText(`Mail 1 von ${first.length}`);
      const results = await new AxeBuilder({ page })
        .disableRules(['label-content-name-mismatch'])
        .exclude('iframe[title^="Inhalt der Mail"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        results.violations.map((v) => `${v.id}: ${v.help} ${v.nodes[0]?.target.join(' ')}`),
      ).toEqual([]);
      await bar.getByRole('button', { name: 'Erledigt' }).click();
      // The done mail left the queue; the walk shows the next one as „1 von n-1“.
      await expect(bar).toContainText(`Mail 1 von ${first.length - 1}`);
      await page.getByRole('button', { name: 'Rückgängig' }).click();
      await expect(bar).toContainText(`von ${first.length}`);
    });
  }
});
