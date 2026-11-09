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
 * elements, words, rows, scroll length). `MAX` holds the target column of TARGET §4 as remeasured after the
 * packages (2026-11-09; the misses are named there): no path may get longer. The table lands in
 * `test-results/usecase-kopf-leer.md` and as the attachment `usecase-kopf-leer`.
 *
 * The mail path needs the demo mails of the seed, which only the Dev-Preview flavour has:
 *   npm run build:e2e-seed && npm run preview:e2e-seed   (port 4174)
 *   USECASE_SEED_URL=http://localhost:4174 npx playwright test e2e/usecases/kopf-leer.spec.ts --project=desktop-chrome
 * Without the variable the mail path is skipped (mail is a desktop-only module; the phone never has it). It stays in
 * this file on purpose: one script per use case (docs/design/usecases), and the seed project is a Dev-Preview build.
 * Friction is counted as taps, keys, screens, dialogs and detours (a scroll is not counted; the docs name it where
 * it happens), never assumed away: a later change lowers the numbers instead of breaking the script. Since package 4 the target state of path A (no pile visible, no select,
 * no booking, no doubled invoice) and the planner's folded group are asserted directly.
 */

const OUT = 'test-results/usecase-kopf-leer';
const TODAY = '2026-09-29'; // Tuesday

type Metric = 'taps' | 'keys' | 'screens' | 'dialogs' | 'detours';
type Row = { name: string; project: string } & Record<Metric, number> & {
    seconds: number;
    ms: number;
  };

/**
 * Upper bounds per path and project: the target column of TARGET §4, remeasured on `develop` after the packages
 * 1, 2, 3a and 3b (2026-11-09, package 4). One number misses its target and stays at the measured value:
 * path B's second screen (the invoice line says „angelegt“, not whether it is in the plan, so the person still
 * checks the planner; target 1 screen · ≈ 4 s, measured 2 · ≈ 6 s – docs/STATUS.md, line „Use case Kopf leer:
 * nachgemessen“). That screen is counted only while the invoice line does not say „Im Plan“.
 * `seconds` follows from the other five (the model above); it is listed so the table reads like TARGET §4.
 */
const MAX: Record<string, Record<Metric | 'seconds', number>> = {
  // prettier-ignore
  'A Kopf leeren: fünf Dinge auf einmal · desktop-chrome': { taps: 2, keys: 141, screens: 1, dialogs: 1, detours: 0, seconds: 42 },
  // prettier-ignore
  'A Kopf leeren: fünf Dinge auf einmal · pixel-7': { taps: 2, keys: 141, screens: 1, dialogs: 1, detours: 0, seconds: 63 },
  // prettier-ignore
  'B Mail → Antwort-ToDo und Rechnung in den Plan · desktop-chrome': { taps: 2, keys: 0, screens: 2, dialogs: 0, detours: 0, seconds: 6 },
  // prettier-ignore
  'C Handy: eine Sache im Vorbeigehen · pixel-7': { taps: 1, keys: 19, screens: 1, dialogs: 1, detours: 0, seconds: 14 },
  // prettier-ignore
  'D Planer öffnen bei Überlast · desktop-chrome': { taps: 0, keys: 0, screens: 1, dialogs: 0, detours: 0, seconds: 2 },
  // prettier-ignore
  'D Planer öffnen bei Überlast · pixel-7': { taps: 0, keys: 0, screens: 1, dialogs: 0, detours: 0, seconds: 2 },
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
  for (const k of ['taps', 'keys', 'screens', 'dialogs', 'detours', 'seconds'] as const)
    expect(row[k], `${name}: ${k} (bound ${max![k]})`).toBeLessThanOrEqual(max![k]);
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
  // Local date parts, not toISOString: a runner east of UTC+12 would otherwise shift the fixture by a day.
  const d = new Date(`${TODAY}T12:00:00`);
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
    // A card counts as visible while it has a box and the sheet's backdrop lets it through (today a
    // translucent dim; F1's target is an opaque backdrop, which takes the count to 0). The native modal makes
    // the page inert, so a hit test would say nothing; the backdrop's computed alpha is what a person sees.
    const strip = document.querySelector('section[aria-label="Jetzt wichtig"]');
    const dialog = document.querySelector('dialog[open]');
    const backdrop = dialog ? getComputedStyle(dialog, '::backdrop').backgroundColor : '';
    // Alpha only from a fourth component (`rgba(r, g, b, a)` or `rgb(r g b / a)`); three components = opaque. A
    // `color(<space> …)` value drops its colour-space word first.
    const parts = (/^(?:rgba?|color)\((.*)\)$/.exec(backdrop)?.[1] ?? '').replace(
      /^[a-z-]+\s+/i,
      '',
    );
    const numbers = parts.split(/[\s,/]+/).filter(Boolean);
    const alpha = numbers.length >= 4 ? Number(numbers[numbers.length - 1]) : 1;
    const opaque = backdrop !== '' && alpha >= 0.98;
    const cards =
      strip && !opaque ? Array.from(strip.querySelectorAll('a, button')).filter(visible).length : 0;
    const list = document.querySelector('[data-testid="capture-rows"]');
    const selects = list ? Array.from(list.querySelectorAll('select')).filter(visible).length : 0;
    // U03: „Mahnung … €“ read as an expense booking, not as an invoice (the selected option of a row).
    const booking = list
      ? Array.from(list.querySelectorAll('select')).some(
          (sel) => sel.selectedOptions[0]?.textContent?.trim() === 'Buchung (Entwurf)',
        )
      : false;
    // `booking` is diagnostic only (annotation, JSON): the store count around the save is the assertion.
    return { cards, selects, booking, backdrop, opaque, strip: !!strip };
  });
  // A batch never books (F1): bookings are counted in the store before and after the save.
  const bookings = () =>
    page.evaluate(
      () =>
        new Promise<number>((resolve, reject) => {
          const open = indexedDB.open('taschenmesser');
          open.onerror = () => reject(new Error('IndexedDB taschenmesser'));
          open.onsuccess = () => {
            let req: IDBRequest;
            try {
              req = open.result
                .transaction('finance_transaction')
                .objectStore('finance_transaction')
                .getAll();
            } catch (e) {
              return reject(new Error(`store finance_transaction: ${String(e)}`));
            }
            req.onerror = () => reject(new Error('store finance_transaction'));
            req.onsuccess = () => {
              open.result.close();
              resolve(
                (req.result as { deletedAt?: number | null }[]).filter((r) => !r.deletedAt).length,
              );
            };
          };
        }),
    );
  const bookedBefore = await bookings();
  await m.tap(page.getByRole('button', { name: 'Alle speichern (5)' }).first());
  // U04: the first „Alle speichern“ may save nothing – a booking line asks for a confirmation first
  // (gone since package 1: a batch never books, the money line is a ToDo with a booking chip).
  const draft = page.getByTestId('capture-draft');
  const saved = page.getByText('5 Dinge gespeichert');
  await expect(draft.or(saved).first()).toBeVisible();
  if (await draft.count()) {
    pile.booking = true; // the confirmation box only appears for a booking line
    m.detour();
    m.dialog();
    await m.tap(draft.getByRole('button', { name: 'Alle speichern (5)' }));
  }
  await expect(saved).toBeVisible();
  // U03: the reminder line must raise the open Stadtwerke invoice, never file a second one (package 2).
  const stadtwerke = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(new Error('IndexedDB taschenmesser'));
        open.onsuccess = () => {
          let req: IDBRequest;
          try {
            req = open.result
              .transaction('invoices_invoice')
              .objectStore('invoices_invoice')
              .getAll();
          } catch (e) {
            return reject(new Error(`store invoices_invoice: ${String(e)}`));
          }
          req.onerror = () => reject(new Error('store invoices_invoice'));
          req.onsuccess = () => {
            open.result.close();
            const all = req.result as { payee?: string; deletedAt?: number | null }[];
            resolve(all.filter((r) => !r.deletedAt && /Stadtwerke/.test(r.payee ?? '')).length);
          };
        };
      }),
  );
  if (stadtwerke > 1) m.detour(); // a doubled invoice the person has to find and delete
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    `${OUT}/A-${info.project.name}-stimulus.json`,
    JSON.stringify({ ...pile, stadtwerkeInvoices: stadtwerke }),
  );
  info.annotations.push({
    type: 'stimulus',
    description: `while unloading: ${pile.cards} attention cards visible beside the sheet (backdrop ${pile.backdrop}) · ${pile.selects} selects in the sheet · booking line ${pile.booking}`,
  });
  // TARGET §4 (F1): nothing of the pile beside the sheet, no select per line, no booking in a batch.
  // 0 cards because the backdrop is opaque – not because the strip happened to be missing.
  expect(pile.opaque, `opaque backdrop (${pile.backdrop})`).toBe(true);
  expect(pile.cards, 'attention cards visible beside the sheet').toBe(0);
  expect(pile.selects, 'selects in the sheet').toBe(0);
  expect(await bookings(), 'bookings written by the batch').toBe(bookedBefore);
  expect(stadtwerke, 'Stadtwerke invoices after the reminder line').toBe(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Where did they land? Until package 1 the person checked the ToDos (a second screen); the closing
  // line now names the place („Sortiert wird später. · Ansehen“), so no visit is counted. The machine
  // still checks that everything arrived.
  const named = await page.getByText('Sortiert wird später.').count();
  if (named) await ready(page, '/todos');
  else await m.go('/todos');
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
  // Package 3a: the reply goes into the plan straight from the row – one tap, no sheet; the row then says
  // „im Plan“. (Before: open the mail, „Aus dieser Mail anlegen“, „ToDo“, a sheet with „Speichern“.)
  const annaRow = page.getByRole('button', { name: /^In den Plan: Anna Beispiel · Wochenende\?/ });
  // The row action appears once the module states are read (a moment after the list); it must be there.
  await expect(annaRow).toBeVisible({ timeout: 10_000 });
  await m.tap(annaRow);
  await expect(page.getByText(/^Im Plan/).first()).toBeVisible();
  // Package 3b: the invoice mail shows payee, amount and due date under its row; one tap writes the invoice
  // (before: open the mail, „Aus dieser Mail anlegen“, „Rechnung“, a sheet with „Speichern“).
  const invoice = page.getByRole('button', {
    name: /^Rechnung anlegen: Stadtwerke Musterstadt · 84,30/,
  });
  await expect(invoice).toBeVisible({ timeout: 10_000 });
  await m.tap(invoice);
  await expect(page.getByText('Rechnung angelegt')).toBeVisible();
  // Is it in the plan? The reply's row says „Im Plan“ (3a); the invoice line says only „angelegt“. While the invoice
  // line's done mark does not say „Im Plan“, the person opens the planner to see it (a counted screen). Only a
  // positive mark counts – „nicht im Plan“, „war im Plan“ or „im Planer“ never drop the screen; it is the capitalised
  // mark of the mail strings (a lowercase one would still count the screen: stricter, never a false pass).
  const invoiceLine = page
    .getByTestId('mail-invoice-line')
    .filter({ hasText: 'Stadtwerke Musterstadt' });
  const saysPlan = await invoiceLine
    .first()
    .getByTestId('mail-invoice-done')
    .filter({ hasText: /^\s*·?\s*Im Plan(\s*·.*|:.*)?$/ })
    .count();
  if (!saysPlan) m.screens += 1;
  await page.goto(`${seed}/planner`);
  await expect(page.getByTestId('planner-head')).toBeVisible();
  await expect(page.getByText('Stadtwerke Musterstadt bezahlen').first()).toBeVisible({
    timeout: 15_000,
  });
  // The reply sits in the plan as „Anna Beispiel · Wochenende?“ (with „Zur Mail“ since 3a). The run that places it
  // follows the ToDo write; wait for it to settle before deciding whether the person has to search.
  const reply = page.getByText(/Wochenende\?$/).first();
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
  // The overload shows as a number in the head of the waiting group, folded with its calming half (F4).
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
  await expect(page.getByText(/Nichts davon muss heute sein/).first()).toBeVisible();
  // Rows outside the day columns = the waiting group (folded since package 1: only its head is a row).
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
  // TARGET §4 (F4: the waiting group folded, the head names the next step); remeasured 2026-11-09: PC 40 · 244 ·
  // 13 · 549 px, phone 23 · 120 · 4 · 437 px. The PC's rows and interactive elements sit exactly at the target:
  // a planner change that adds one fails here on purpose (run this script for planner PRs).
  const bound = isMobile
    ? { interactive: 25, words: 200, rows: 5, scroll: 800 }
    : { interactive: 40, words: 280, rows: 13, scroll: 700 };
  expect(s.interactive, 'interactive elements').toBeLessThanOrEqual(bound.interactive);
  expect(s.words, 'words').toBeLessThanOrEqual(bound.words);
  expect(s.rows, 'rows').toBeLessThanOrEqual(bound.rows);
  expect(s.scroll, 'scroll px').toBeLessThanOrEqual(bound.scroll);
  await record(info, m, name);
});
