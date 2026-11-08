import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { dismissNotices, ready, showPreview } from '../helpers';

/**
 * Use case „Kopf leer“ (docs/design/usecases/kopf-leer/ANALYSIS.md): an overwhelmed person wants everything out
 * of their head and into the plan – five things at once, one thing in passing on the phone, two mails that
 * must become a reply and an invoice, then a look at the planner. Each path counts taps, typed characters,
 * screens, dialogs and detours (an action that did not do what the person meant), and estimates the seconds a
 * person needs for them (model: tap 1 s, character 0,25 s on a keyboard / 0,4 s on a phone, screen change 2 s,
 * reading a dialog 3 s, detour 5 s). The last path measures the stimulus load of the planner page (interactive
 * elements, words, rows, scroll length). `MAX` holds the numbers measured on `develop` (2026-11-08): no path
 * may get longer. The table lands in `test-results/usecase-kopf-leer.md` and as the attachment `usecase-kopf-leer`.
 *
 * The mail path needs the demo mails of the seed, which only the Dev-Preview flavour has:
 *   npm run build:e2e-seed && npm run preview:e2e-seed   (port 4174)
 *   USECASE_SEED_URL=http://localhost:4174 npx playwright test e2e/usecases/kopf-leer.spec.ts --project=desktop-chrome
 * Without the variable the mail path is skipped (mail is a desktop-only module; the phone never has it). It stays in
 * this file on purpose: one script per use case (docs/design/usecases), and the seed project is a Dev-Preview build.
 * Friction that the packages will remove is counted as a detour, never asserted, so a package lowers the numbers
 * instead of breaking the script.
 */

const OUT = 'test-results/usecase-kopf-leer';
const TODAY = '2026-09-29'; // Tuesday

type Metric = 'taps' | 'keys' | 'screens' | 'dialogs' | 'detours';
type Row = { name: string; project: string } & Record<Metric, number> & {
    seconds: number;
    ms: number;
  };

/** Baseline on `develop`: upper bounds per path and project (taps · keys · screens · dialogs · detours). */
const MAX: Record<string, Record<Metric, number>> = {
  // prettier-ignore
  'A Kopf leeren: fünf Dinge auf einmal · desktop-chrome': { taps: 3, keys: 141, screens: 2, dialogs: 2, detours: 1 },
  // prettier-ignore
  'A Kopf leeren: fünf Dinge auf einmal · pixel-7': { taps: 3, keys: 141, screens: 2, dialogs: 2, detours: 1 },
  // prettier-ignore
  'B Mail → Antwort-ToDo und Rechnung in den Plan · desktop-chrome': { taps: 9, keys: 0, screens: 2, dialogs: 2, detours: 0 },
  // prettier-ignore
  'C Handy: eine Sache im Vorbeigehen · pixel-7': { taps: 1, keys: 19, screens: 1, dialogs: 1, detours: 0 },
  // prettier-ignore
  'D Planer öffnen bei Überlast · desktop-chrome': { taps: 0, keys: 0, screens: 1, dialogs: 0, detours: 0 },
  // prettier-ignore
  'D Planer öffnen bei Überlast · pixel-7': { taps: 0, keys: 0, screens: 1, dialogs: 0, detours: 0 },
};

class Meter {
  taps = 0;
  keys = 0;
  screens = 0;
  dialogs = 0;
  detours = 0;
  private readonly started = Date.now();
  constructor(
    private page: Page,
    private mobile: boolean,
  ) {}
  async tap(target: Locator) {
    this.taps += 1;
    if (this.mobile) await target.tap();
    else await target.click();
  }
  /** Typing counts every character; `fill` keeps the test fast, the person types them. */
  async type(target: Locator, text: string) {
    this.keys += text.length;
    await target.fill(text);
  }
  async enter(target: Locator) {
    this.keys += 1;
    await target.press('Enter');
  }
  /** A new screen the person has to find (a route change, not a dialog). */
  async go(url: string) {
    this.screens += 1;
    await ready(this.page, url);
  }
  dialog() {
    this.dialogs += 1;
  }
  /** The app did something else than the person meant; the person has to notice and act again. */
  detour() {
    this.detours += 1;
  }
  row(name: string, project: string): Row {
    const perKey = this.mobile ? 0.4 : 0.25;
    const seconds =
      this.taps * 1 + this.keys * perKey + this.screens * 2 + this.dialogs * 3 + this.detours * 5;
    return {
      name,
      project,
      taps: this.taps,
      keys: this.keys,
      screens: this.screens,
      dialogs: this.dialogs,
      detours: this.detours,
      seconds: Math.round(seconds),
      ms: Date.now() - this.started,
    };
  }
}

function writeTable() {
  const rows: Row[] = readdirSync(OUT)
    .filter((f) => f.endsWith('.json') && !f.includes('stimulus'))
    .filter((f) => !f.endsWith('.tmp'))
    .sort()
    .map((f) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')));
  const table = [
    '| Path | Project | Taps | Keys | Screens | Dialogs | Detours | ≈ s (person) | ms (machine) |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.name} | ${r.project} | ${r.taps} | ${r.keys} | ${r.screens} | ${r.dialogs} | ${r.detours} | ${r.seconds} | ${r.ms} |`,
    ),
  ].join('\n');
  // Temp file + rename: workers run in parallel and a half-written file must never be read.
  const tmp = `${OUT}/table.${process.pid}.tmp`;
  writeFileSync(tmp, `${table}\n`);
  renameSync(tmp, 'test-results/usecase-kopf-leer.md');
}

async function record(info: TestInfo, meter: Meter, name: string) {
  const project = info.project.name;
  const row = meter.row(name, project);
  mkdirSync(OUT, { recursive: true });
  const file = `${OUT}/${name.slice(0, 1)}-${project}.json`;
  writeFileSync(`${file}.tmp`, JSON.stringify(row));
  renameSync(`${file}.tmp`, file);
  writeTable();
  await info.attach('usecase-kopf-leer', { path: 'test-results/usecase-kopf-leer.md' });
  const max = MAX[`${name} · ${project}`];
  expect(max, `no baseline for „${name}“ on ${project}`).toBeTruthy();
  for (const k of ['taps', 'keys', 'screens', 'dialogs', 'detours'] as const)
    expect(row[k], `${name}: ${k} (baseline ${max![k]})`).toBeLessThanOrEqual(max![k]);
  info.annotations.push({
    type: 'usecase',
    description: `${name}: ${row.taps} taps · ${row.keys} keys · ${row.screens} screens · ${row.dialogs} dialogs · ${row.detours} detours · ≈ ${row.seconds} s`,
  });
}

/** What a person has to take in on one screen (focus checklist 1): counted on the visible page. */
async function stimulus(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body;
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const interactive = Array.from(
      main.querySelectorAll('button, a[href], input, select, textarea, [role="button"]'),
    ).filter(visible).length;
    const rows = Array.from(main.querySelectorAll('li')).filter(visible).length;
    // innerText leaves out what is not rendered (closed groups, display: none).
    const words = ((main as HTMLElement).innerText ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    const scroller = main.scrollHeight > main.clientHeight + 1 ? main : document.scrollingElement!;
    const scroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    return { interactive, rows, words, scroll };
  });
}

const env = (data: Record<string, unknown>, id: string) => ({
  ...data,
  id,
  createdAt: 1,
  updatedAt: 1,
  deviceId: 'e2e',
  deletedAt: null,
  _f: {},
});

/** Days from TODAY as 'YYYY-MM-DD'. */
const day = (offset: number) => {
  const d = new Date(`${TODAY}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

/**
 * An overloaded week: 18 open ToDos (ten of 4 h, eight of 1 h = 48 h of work against about 35 h of usable time
 * in the planner's 14-day horizon), two open invoices (one past its date), the modules todos, planner, invoices
 * and calendar on. Written straight into IndexedDB like the library and the editors would.
 */
async function prepare(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  const tasks: Record<string, unknown>[] = [];
  const titles = [
    'Steuererklärung vorbereiten',
    'Bewerbungsmappe fertig machen',
    'Keller entrümpeln',
    'Website der Nachbarschaftshilfe',
    'Fotobuch für Oma',
    'Fahrrad zur Reparatur',
    'Versicherungen vergleichen',
    'Arbeitszimmer streichen',
    'Steuerbescheid prüfen',
    'Unterlagen für die Bank',
    'Zahnarzttermin ausmachen',
    'Glühbirne im Flur wechseln',
    'Paket zurückschicken',
    'Oma anrufen',
    'Auto waschen',
    'Pflanzen umtopfen',
    'Drucker einrichten',
    'Blumen für Anna bestellen',
  ];
  titles.forEach((title, i) =>
    tasks.push(
      env(
        {
          listId: 'inbox',
          title,
          done: false,
          priority: i % 4,
          order: i,
          estimateMin: i < 10 ? 240 : 60,
          ...(i % 3 === 0 ? { dueDate: day(3 + i) } : {}),
        },
        `t${i}`,
      ),
    ),
  );
  await page.evaluate(
    ({ tasks, today, week }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(
            ['_modules', 'todos_list', 'todos_task', 'invoices_invoice'],
            'readwrite',
          );
          for (const id of ['todos', 'planner', 'invoices', 'calendar'])
            tx.objectStore('_modules').put({
              id,
              enabled: true,
              dataPolicy: null,
              createdAt: 1,
              updatedAt: 1,
              deviceId: 'e2e',
              deletedAt: null,
              _f: {},
            });
          tx.objectStore('todos_list').put({
            id: 'inbox',
            name: 'Eingang',
            order: 0,
            createdAt: 1,
            updatedAt: 1,
            deviceId: 'e2e',
            deletedAt: null,
            _f: {},
          });
          for (const t of tasks) tx.objectStore('todos_task').put(t);
          const inv = (id: string, payee: string, amountMinor: number, dueDate: string) =>
            tx.objectStore('invoices_invoice').put({
              id,
              payee,
              amountMinor,
              dueDate,
              status: 'open',
              createdAt: 1,
              updatedAt: 1,
              deviceId: 'e2e',
              deletedAt: null,
              _f: {},
            });
          inv('i1', 'Stadtwerke Musterstadt', 8740, today);
          inv('i2', 'Internetanbieter Muster', 3999, week);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { tasks, today: day(-5), week: day(6) },
  );
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00`));
  await dismissNotices(page);
});

test('A Kopf leeren: fünf Dinge auf einmal', async ({ page, isMobile }, info) => {
  const name = 'A Kopf leeren: fünf Dinge auf einmal';
  await prepare(page);
  const m = new Meter(page, isMobile);
  await m.go('/');
  // The home screen shows the pile first („Jetzt wichtig“ with the overdue invoice); then the one round button.
  await expect(page.getByRole('region', { name: 'Jetzt wichtig' }))
    .toBeVisible({ timeout: 5_000 })
    .catch(() => undefined);
  await m.tap(page.getByRole('button', { name: 'Schnell hinzufügen' }));
  m.dialog();
  const input = page.getByRole('textbox', { name: 'Was möchtest du festhalten?' }).last();
  await expect(input).toBeVisible();
  const lines = [
    'Müll runterbringen',
    'Wohnzimmer aufräumen',
    'Vermieter wegen Heizung antworten',
    'Steuerbescheid prüfen bis Freitag',
    'Mahnung Stadtwerke 87,40 € zahlen',
  ];
  await m.type(input, lines.join('\n'));
  // One line per entry; the sheet shows a target per line.
  const rows = page.getByTestId('capture-rows');
  await expect(rows.getByText('Steuerbescheid prüfen', { exact: true })).toBeVisible();
  // S7 while unloading: what the person sees beside the sheet (the pile) and inside it (choices per line).
  const pile = await page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const strip = document.querySelector('section[aria-label="Jetzt wichtig"]');
    const cards = strip
      ? Array.from(strip.querySelectorAll('a, button')).filter(visible).length
      : 0;
    const list = document.querySelector('[data-testid="capture-rows"]');
    const selects = list ? Array.from(list.querySelectorAll('select')).filter(visible).length : 0;
    // U03: „Mahnung … €“ read as an expense booking, not as an invoice (the selected option of a row).
    const booking = list
      ? Array.from(list.querySelectorAll('select')).some(
          (sel) => sel.selectedOptions[0]?.textContent?.trim() === 'Buchung (Entwurf)',
        )
      : false;
    return { cards, selects, booking };
  });
  await m.tap(page.getByRole('button', { name: 'Alle speichern (5)' }).first());
  // U04: the first „Alle speichern“ may save nothing – a booking line asks for a confirmation first.
  const draft = page.getByTestId('capture-draft');
  const saved = page.getByText('5 Dinge gespeichert');
  await expect(draft.or(saved).first()).toBeVisible();
  if (await draft.count()) {
    m.detour();
    m.dialog();
    await m.tap(draft.getByRole('button', { name: 'Alle speichern (5)' }));
  }
  await expect(saved).toBeVisible();
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/A-${info.project.name}-stimulus.json`, JSON.stringify(pile));
  info.annotations.push({
    type: 'stimulus',
    description: `while unloading: ${pile.cards} attention cards visible beside the sheet · ${pile.selects} selects in the sheet · booking line ${pile.booking}`,
  });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Where did they land? The person checks the ToDos.
  await m.go('/todos');
  await expect(page.getByText('Müll runterbringen', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText('Vermieter wegen Heizung antworten', { exact: true }).first(),
  ).toBeVisible();
  await record(info, m, name);
});

test('B Mail → Antwort-ToDo und Rechnung in den Plan', async ({ page, isMobile }, info) => {
  const name = 'B Mail → Antwort-ToDo und Rechnung in den Plan';
  test.skip(isMobile, 'mail is a desktop-only module (U06)');
  const seed = process.env.USECASE_SEED_URL;
  test.skip(
    !seed,
    'needs the demo mails of a seeded Dev-Preview: USECASE_SEED_URL=http://localhost:4174',
  );
  test.setTimeout(180_000);
  // Pose as the Windows app, show preview modules, load the medium seed (the real UI path), switch mail on.
  await page.addInitScript(() => {
    localStorage.setItem('__tmPlatformKind', 'desktop');
    localStorage.setItem('tm-seed-autofilled', '1');
  });
  await showPreview(page);
  await page.goto(`${seed}/settings/entwickler`);
  await expect(page.locator('main h1')).toBeVisible();
  const section = page.locator('section[aria-labelledby="developer"]');
  await section.getByLabel('Umfang').selectOption('medium');
  await section.getByTestId('seed-load').click();
  await expect(section.getByTestId('seed-status')).toContainText(TODAY, { timeout: 90_000 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          for (const id of ['mail', 'planner'])
            tx.objectStore('_modules').put({
              id,
              enabled: true,
              dataPolicy: null,
              createdAt: 1,
              updatedAt: 1,
              deviceId: 'e2e',
              deletedAt: null,
              _f: {},
            });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  const m = new Meter(page, false);
  m.screens += 1;
  await page.goto(`${seed}/mail`);
  await expect(page.getByText('Beispiel-Mails (Testdaten)')).toBeVisible();
  // There is no „needs an answer“ view: the person reads the list and picks Anna's mail.
  await m.tap(page.getByText('Wochenende?'));
  await m.tap(page.getByRole('button', { name: 'Aus dieser Mail anlegen' }));
  await m.tap(page.getByRole('menuitem', { name: 'ToDo' }));
  m.dialog();
  const dialog = page.getByRole('dialog');
  // U07: today the ToDo is prefilled with the subject („Wochenende?“), not with the intent; recorded, not asserted.
  const prefilled = await dialog.getByRole('textbox').inputValue();
  info.annotations.push({ type: 'usecase', description: `mail → ToDo prefill: „${prefilled}“` });
  await m.tap(dialog.getByRole('button', { name: 'Speichern' }));
  await expect(page.getByTestId('mail-linked')).toContainText('ToDo');
  // The invoice mail.
  await m.tap(page.getByRole('button', { name: 'Zur Liste' }));
  await m.tap(page.getByText('Ihre Rechnung für Oktober'));
  await m.tap(page.getByRole('button', { name: 'Aus dieser Mail anlegen' }));
  await m.tap(page.getByRole('menuitem', { name: 'Rechnung' }));
  m.dialog();
  await expect(dialog.getByTestId('capture-chips')).toContainText('84,30');
  await m.tap(dialog.getByRole('button', { name: 'Speichern' }));
  await expect(page.getByTestId('mail-linked')).toContainText('Rechnung: Stadtwerke Musterstadt');
  // Is it in the plan? A second screen to check (U09: nothing in the mail says so).
  m.screens += 1;
  await page.goto(`${seed}/planner`);
  await expect(page.getByTestId('planner-head')).toBeVisible();
  await expect(page.getByText('Stadtwerke Musterstadt bezahlen').first()).toBeVisible({
    timeout: 15_000,
  });
  // U09: the reply sits in the plan under the mail's subject; nothing says it came from a mail. The run that
  // places it follows the ToDo write; wait for it to settle before deciding whether the person has to search.
  const reply = page.getByText('Wochenende?', { exact: true }).first();
  await expect(reply)
    .toBeVisible({ timeout: 15_000 })
    .catch(() => m.detour()); // waiting or not placed: the person has to look for it
  await record(info, m, name);
});

test('C Handy: eine Sache im Vorbeigehen', async ({ page, isMobile }, info) => {
  const name = 'C Handy: eine Sache im Vorbeigehen';
  test.skip(!isMobile, 'phone path');
  await prepare(page);
  const m = new Meter(page, true);
  await m.go('/');
  await m.tap(page.getByRole('button', { name: 'Schnell hinzufügen' }));
  m.dialog();
  const input = page.getByRole('textbox', { name: 'Was möchtest du festhalten?' }).last();
  await m.type(input, 'Müll runterbringen');
  await expect(page.getByTestId('capture-chips')).toContainText('Ziel: ToDos');
  await m.enter(input);
  await expect(page.getByText('Gespeichert in ToDos')).toBeVisible();
  await record(info, m, name);
});

test('D Planer öffnen bei Überlast', async ({ page, isMobile }, info) => {
  const name = 'D Planer öffnen bei Überlast';
  await prepare(page);
  const m = new Meter(page, isMobile);
  await m.go('/planner');
  const head = page.getByTestId('planner-head');
  await expect(head).toContainText('frei heute');
  // The overload shows as a number in the head of the waiting group – and as the whole waiting list.
  const waiting = page.getByText(/Wartet auf freie Zeit/);
  await expect(waiting).toBeVisible({ timeout: 15_000 });
  // Settled: the run may still add rows after the heading appears.
  const rowCount = () => page.locator('main li').count();
  let last = await rowCount();
  for (let i = 0; i < 10; i += 1) {
    await page.waitForTimeout(300);
    const now = await rowCount();
    if (now === last) break;
    last = now;
  }
  const s = await stimulus(page);
  // Rows outside the day columns = the waiting group (every waiting thing is listed, with its reason).
  const waitingCount = await page.evaluate(() => {
    const all = document.querySelectorAll('main li').length;
    const inDays = document.querySelectorAll('main [data-testid^="day-"] li').length;
    return all - inDays;
  });
  info.annotations.push({
    type: 'stimulus',
    description: `planner: ${s.interactive} interactive · ${s.words} words · ${s.rows} rows · ${s.scroll} px scroll · waiting rows ${waitingCount}`,
  });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    `${OUT}/D-${info.project.name}-stimulus.json`,
    JSON.stringify({ ...s, waitingCount }),
  );
  await info.attach('usecase-kopf-leer-stimulus', {
    body: JSON.stringify({ ...s, waitingCount }),
    contentType: 'application/json',
  });
  // Baseline on develop (U12), measured + about a tenth: no package may make the page longer.
  const bound = isMobile
    ? { interactive: 43, words: 425, rows: 22, scroll: 1600 }
    : { interactive: 62, words: 560, rows: 32, scroll: 1400 };
  expect(s.interactive, 'interactive elements').toBeLessThanOrEqual(bound.interactive);
  expect(s.words, 'words').toBeLessThanOrEqual(bound.words);
  expect(s.rows, 'rows').toBeLessThanOrEqual(bound.rows);
  expect(s.scroll, 'scroll px').toBeLessThanOrEqual(bound.scroll);
  await record(info, m, name);
});
