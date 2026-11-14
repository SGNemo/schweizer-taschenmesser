import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { dismissNotices, ready, showPreview } from '../helpers';

/**
 * Use case „Wochenende retten“ (docs/design/usecases/wochenende/ANALYSIS.md): Saturday morning, first use of the
 * app; the person wants to lay out Saturday, Sunday and the next days – about a dozen things at once, a break for
 * gaming, work time to log, mails with invoices, the rest moved on in the evening, a Sunday deadline and a
 * Monday-morning thing, and a bedtime the plan respects. Each path counts taps, typed characters, screens,
 * dialogs and detours (an action that did not do what the person meant) and estimates the seconds a person needs
 * (same model as kopf-leer: tap 1 s, character 0,25 s keyboard / 0,4 s phone, screen 2 s, dialog 3 s, detour 5 s).
 * `MAX` holds the measured state of `develop` (2026-11-14): no path may get longer; the packages in PACKAGES.md
 * lower it to the target column of TARGET §4. The table lands in `test-results/usecase-wochenende.md`.
 *
 * Starting point is an empty install (no seed, no test data): path A goes through the welcome card and the setup
 * questions; the other paths switch on only the modules the path needs (todos, planner; timetrack in D) the way
 * the library would, so each path is measured on its own. Facts the docs quote (where the dump lines landed,
 * what the planner holds on Saturday and Sunday) go to `test-results/usecase-wochenende/*-facts.json`.
 *
 * The mail path needs the demo mails of the seed, which only the Dev-Preview flavour has (as in kopf-leer):
 *   npm run build:e2e-seed && npm run preview:e2e-seed   (port 4174)
 *   USECASE_SEED_URL=http://localhost:4174 npx playwright test e2e/usecases/wochenende.spec.ts --project=desktop-chrome
 * Without the variable path E is skipped. Connecting Gmail itself needs an own Google OAuth client and a browser
 * login; it cannot run here and is counted by hand in ANALYSIS §2.
 */

const OUT = 'test-results/usecase-wochenende';
const SATURDAY = '2026-11-14';
const SUNDAY = '2026-11-15';

type Metric = 'taps' | 'keys' | 'screens' | 'dialogs' | 'detours';
type Row = { name: string; project: string } & Record<Metric, number> & {
    seconds: number;
    ms: number;
  };

/** Measured on `develop` 35499492 (2026-11-14). Packages lower these to TARGET §4; never raise them. */
const MAX: Record<string, Record<Metric | 'seconds', number>> = {
  // prettier-ignore
  'A Erster Start bis Planer · desktop-chrome': { taps: 10, keys: 0, screens: 3, dialogs: 1, detours: 1, seconds: 24 },
  // prettier-ignore
  'A Erster Start bis Planer · pixel-7': { taps: 11, keys: 0, screens: 3, dialogs: 1, detours: 1, seconds: 25 },
  // prettier-ignore
  'B Kopf leeren: zwölf Dinge auf einmal · desktop-chrome': { taps: 2, keys: 280, screens: 0, dialogs: 1, detours: 3, seconds: 90 },
  // prettier-ignore
  'B Kopf leeren: zwölf Dinge auf einmal · pixel-7': { taps: 2, keys: 280, screens: 0, dialogs: 1, detours: 3, seconds: 132 },
  // prettier-ignore
  'C Wochenende einteilen · desktop-chrome': { taps: 23, keys: 9, screens: 1, dialogs: 2, detours: 1, seconds: 38 },
  // prettier-ignore
  'C Wochenende einteilen · pixel-7': { taps: 23, keys: 9, screens: 1, dialogs: 2, detours: 1, seconds: 40 },
  // prettier-ignore
  'D Arbeitszeit nachtragen · desktop-chrome': { taps: 6, keys: 20, screens: 2, dialogs: 1, detours: 0, seconds: 18 },
  // prettier-ignore
  'E Mail: Persönlich, Suche, Rechnung, Antwort in den Plan · desktop-chrome': { taps: 4, keys: 9, screens: 1, dialogs: 0, detours: 0, seconds: 8 },
  // prettier-ignore
  'F Abend: Rest auf andere Tage · desktop-chrome': { taps: 9, keys: 0, screens: 1, dialogs: 1, detours: 1, seconds: 19 },
  // prettier-ignore
  'F Abend: Rest auf andere Tage · pixel-7': { taps: 9, keys: 0, screens: 1, dialogs: 1, detours: 1, seconds: 19 },
  // prettier-ignore
  'G Sonntag-Frist und Montag früh · desktop-chrome': { taps: 2, keys: 102, screens: 1, dialogs: 1, detours: 2, seconds: 43 },
  // prettier-ignore
  'H Schlaf: Abendgrenze für den Plan · desktop-chrome': { taps: 3, keys: 10, screens: 2, dialogs: 0, detours: 1, seconds: 15 },
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
  /** A new screen reached through a navigation tap (counted as tap + screen). */
  async nav(target: Locator, h1: RegExp) {
    await this.tap(target);
    this.screens += 1;
    await expect(this.page.locator('main h1')).toContainText(h1);
  }
  /** A screen opened without a visible way (address or first load). */
  async go(url: string) {
    this.screens += 1;
    await ready(this.page, url);
  }
  dialog() {
    this.dialogs += 1;
  }
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
    .filter((f) => f.endsWith('.json') && !f.includes('facts'))
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
  renameSync(tmp, 'test-results/usecase-wochenende.md');
}

function facts(info: TestInfo, key: string, data: unknown) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${key}-${info.project.name}-facts.json`, JSON.stringify(data, null, 1));
  info.annotations.push({ type: 'facts', description: `${key}: ${JSON.stringify(data)}` });
}

async function record(info: TestInfo, meter: Meter, name: string) {
  const project = info.project.name;
  const row = meter.row(name, project);
  mkdirSync(OUT, { recursive: true });
  const file = `${OUT}/${name.slice(0, 1)}-${project}.json`;
  writeFileSync(`${file}.tmp`, JSON.stringify(row));
  renameSync(`${file}.tmp`, file);
  writeTable();
  await info.attach('usecase-wochenende', { path: 'test-results/usecase-wochenende.md' });
  const max = MAX[`${name} · ${project}`];
  expect(max, `no baseline for „${name}“ on ${project}`).toBeTruthy();
  for (const k of ['taps', 'keys', 'screens', 'dialogs', 'detours', 'seconds'] as const)
    expect(row[k], `${name}: ${k} (bound ${max![k]})`).toBeLessThanOrEqual(max![k]);
  info.annotations.push({
    type: 'usecase',
    description: `${name}: ${row.taps} taps · ${row.keys} keys · ${row.screens} screens · ${row.dialogs} dialogs · ${row.detours} detours · ≈ ${row.seconds} s`,
  });
}

const meta = (id: string) => ({
  id,
  createdAt: 1,
  updatedAt: 1,
  deviceId: 'e2e',
  deletedAt: null,
  _f: {},
});

/**
 * An empty install with only the named modules switched on (what one switch in the library writes) and,
 * optionally, open ToDos – nothing else: no seed, no settings, no planner days.
 */
async function prepare(
  page: Page,
  modules: string[],
  tasks: { title: string; plannedFor?: string; dueDate?: string }[] = [],
) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    ({ modules, tasks, base }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['_modules', 'todos_list', 'todos_task'], 'readwrite');
          for (const id of modules)
            tx.objectStore('_modules').put({ ...base, id, enabled: true, dataPolicy: null });
          if (tasks.length) {
            tx.objectStore('todos_list').put({ ...base, id: 'inbox', name: 'Eingang', order: 0 });
            tasks.forEach((t, i) =>
              tx.objectStore('todos_task').put({
                ...base,
                id: `w${i}`,
                listId: 'inbox',
                done: false,
                priority: 0,
                order: i,
                ...t,
              }),
            );
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { modules, tasks, base: meta('x') },
  );
}

/** Rows of one store (not deleted), read the way the e2e helpers of kopf-leer read them. */
async function rows<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    (store) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(new Error('IndexedDB taschenmesser'));
        open.onsuccess = () => {
          let req: IDBRequest;
          try {
            req = open.result.transaction(store).objectStore(store).getAll();
          } catch {
            open.result.close();
            return resolve([]); // the store does not exist (yet): nothing there
          }
          req.onerror = () => reject(new Error(store));
          req.onsuccess = () => {
            open.result.close();
            resolve(
              (req.result as (T & { deletedAt?: number | null })[]).filter((r) => !r.deletedAt),
            );
          };
        };
      }),
    store,
  );
}

/** What the planner shows per day (titles of the plan rows) and how many wait, read from the page. */
async function planOf(page: Page) {
  return page.evaluate(() => {
    const titles = (sel: string) =>
      Array.from(document.querySelectorAll(`${sel} li`))
        .map((li) => (li as HTMLElement).innerText.split('\n')[0]!.trim())
        .filter(Boolean);
    const shownDay = document
      .querySelector('main [data-testid^="day-"]')
      ?.getAttribute('data-testid');
    return {
      shownDay,
      head: (
        document.querySelector('[data-testid="planner-head"]') as HTMLElement | null
      )?.innerText
        .replace(/\s+/g, ' ')
        .trim(),
      waitingHead: Array.from(document.querySelectorAll('main *'))
        .map((e) => (e as HTMLElement).innerText ?? '')
        .find((s) => /^Wartet auf freie Zeit/.test(s))
        ?.split('\n')[0],
      shown: titles('main [data-testid^="day-"]'),
      // Desktop: one row per day („Sa. 14. · 1 h 42 frei von 3 h 12 · 3 Dinge“); phone: the strip chips.
      week: Array.from(
        document.querySelectorAll('main [aria-label="Woche"] li, main [aria-label="Tage"] button'),
      ).map((e) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim()),
    };
  });
}

/**
 * The number of rows a locator finds once the planner run has settled: two reads 400 ms apart agree (a run
 * may still add or move rows after the page shows them; a fixed wait would be flaky under load). 400 ms covers
 * the run's debounce (50 ms) and a run on this small plan; a run that has not started yet reads as settled too,
 * so a path whose target is „rows appear“ should wait for them (`toHaveCount`) instead of counting 0 as final.
 */
async function settledCount(loc: Locator): Promise<number> {
  let last = -1;
  await expect
    .poll(
      async () => {
        const now = await loc.count();
        const same = now === last;
        last = now;
        return same;
      },
      { intervals: [400], timeout: 15_000 },
    )
    .toBe(true);
  return last;
}

/** A module link in the sidebar; a folded area group is opened first (one more tap). */
async function sideLink(page: Page, m: Meter, name: string, group: string) {
  const link = page.getByRole('link', { name, exact: true });
  if (!(await link.isVisible().catch(() => false)))
    await m.tap(page.getByRole('button', { name: `${group} auf- oder zuklappen` }));
  return link;
}

/** Steps the day sheet's „Mehr Zeit“ until the value reads `target`; every tap counts. */
async function stepTo(m: Meter, sheet: Locator, target: string) {
  const value = sheet.getByTestId('day-available');
  for (let i = 0; i < 24 && (await value.innerText()) !== target; i += 1) {
    const before = await value.innerText();
    await m.tap(sheet.getByRole('button', { name: 'Mehr Zeit' }));
    await expect(value).not.toHaveText(before);
  }
  await expect(value).toHaveText(target);
}

const openPlannerDay = async (page: Page, m: Meter, mobile: boolean, label: RegExp) => {
  // Desktop: the week list on the left picks the day, its head on the right opens the day sheet.
  // Phone: the strip picks the day, the day's head opens the sheet. Both are two taps.
  if (mobile)
    await m.tap(page.getByRole('group', { name: 'Tage' }).getByRole('button', { name: label }));
  else await m.tap(page.getByRole('button', { name: label }).first());
  await m.tap(page.locator('[data-testid^="day-"] button').first());
  await expect(page.getByRole('dialog')).toBeVisible();
  m.dialog();
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${SATURDAY}T08:30:00`));
  await dismissNotices(page);
});

test('A Erster Start bis Planer', async ({ page, isMobile }, info) => {
  const name = 'A Erster Start bis Planer';
  const m = new Meter(page, isMobile);
  await m.go('/');
  // The welcome card offers the setup; the four questions, the nearest profile („Alltag“: calendar, tasks …).
  await m.tap(page.getByRole('button', { name: 'Einrichtung starten' }));
  m.dialog();
  const dialog = page.getByRole('dialog');
  await m.tap(dialog.getByRole('button', { name: 'Weiter', exact: true }));
  await m.tap(dialog.getByRole('button', { name: 'Alltag: Wählen' }));
  await m.tap(dialog.getByRole('button', { name: 'Weiter', exact: true }));
  await m.tap(dialog.getByRole('button', { name: 'Weiter', exact: true }));
  await m.tap(dialog.getByRole('button', { name: 'Fragen abschließen' }));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // No profile switches the planner on and the setup lands on the overview: the person looks for it and has
  // to go through the library (a detour: the setup did not give what was meant).
  const plannerInNav = await page.getByRole('link', { name: 'Planer', exact: true }).count();
  if (!plannerInNav) m.detour();
  if (isMobile) {
    await m.tap(page.getByRole('button', { name: 'Mehr', exact: true }));
    await m.nav(page.getByRole('link', { name: 'Modul-Bibliothek' }).last(), /Modul-Bibliothek/);
  } else {
    await m.nav(page.getByRole('link', { name: 'Modul-Bibliothek' }), /Modul-Bibliothek/);
  }
  await m.tap(page.getByRole('switch', { name: 'Planer einschalten' }));
  await expect(page.getByRole('switch', { name: 'Planer einschalten' })).toBeChecked();
  if (isMobile) {
    await m.tap(page.getByRole('link', { name: 'Planen', exact: true }));
    await m.nav(page.getByRole('link', { name: /^Planer/ }).first(), /Planer/);
  } else {
    await m.nav(await sideLink(page, m, 'Planer', 'Planen'), /Planer/);
  }
  await expect(page.getByTestId('planner-head')).toBeVisible();
  facts(info, 'A', { plannerInNavAfterSetup: plannerInNav > 0, ...(await planOf(page)) });
  await record(info, m, name);
});

/** The person's morning, one line each, as typed (gaming is meant as a break, not a task). */
const DUMP = [
  'Arbeitszeit eintragen',
  'WhatsApp antworten',
  'Mails checken und beantworten',
  'Rechnungen aus den Mails übernehmen',
  'Zocken',
  'Bude aufräumen',
  'Duschen',
  'Pfand zusammenräumen',
  'Team-Sachen lesen bis So 18:00',
  'So 19 Uhr kurz schauen wie es mir geht',
  'Mo 7:30 krankmelden falls nötig',
  'Schlafrhythmus fixen',
];

test('B Kopf leeren: zwölf Dinge auf einmal', async ({ page, isMobile }, info) => {
  const name = 'B Kopf leeren: zwölf Dinge auf einmal';
  await prepare(page, ['todos', 'planner']);
  const m = new Meter(page, isMobile);
  await ready(page, '/');
  await m.tap(page.getByRole('button', { name: /Neu: etwas eintragen|Neu eintragen/ }));
  m.dialog();
  const input = page.getByRole('textbox', { name: 'Was möchtest du festhalten?' }).last();
  await m.type(input, DUMP.join('\n'));
  await expect(page.getByTestId('capture-rows')).toContainText('Schlafrhythmus fixen');
  const kinds = await page
    .getByTestId('capture-rows')
    .evaluate((list) => (list as HTMLElement).innerText.split('\n').filter(Boolean));
  await m.tap(page.getByRole('button', { name: `Alle speichern (${DUMP.length})` }).first());
  await expect(page.getByText(`${DUMP.length} Dinge gespeichert`)).toBeVisible();
  // Where did the lines land? Each one that does not become what was meant is a detour the person has to fix.
  const tasks = await rows<{ title: string; dueDate?: string }>(page, 'todos_task');
  const events = await rows<{
    title: string;
    startDate?: string;
    startTime?: string;
    kind?: string;
  }>(page, 'calendar_event');
  const task = (t: RegExp) => tasks.find((x) => t.test(x.title));
  const event = (t: RegExp) => events.find((x) => t.test(x.title));
  // (1) „bis So 18:00“ is a deadline for a thing to do, not an appointment at 18:00.
  const teamDeadline = task(/Team-Sachen/)?.dueDate === SUNDAY;
  if (!teamDeadline) m.detour();
  // (2) „Zocken“ is the break, not a ToDo the planner fills the day with.
  const gamingTask = !!task(/^Zocken/);
  if (gamingTask) m.detour();
  // (3) „Mo 7:30 krankmelden“ is a thing to do at a time with a reminder; an appointment blocks an hour instead.
  const kindOf = (t: RegExp) => {
    const ev = event(t);
    return task(t) ? 'todo' : ev ? (ev.kind ?? 'event') : 'none';
  };
  const mondayKind = kindOf(/krankmelden/i);
  if (mondayKind !== 'reminder') m.detour();
  // The Sunday-evening line: a reminder is what was meant.
  const sundayKind = kindOf(/kurz schauen/i);
  // What the plan makes of it (Saturday has 2 h, Sunday 0 by default).
  await ready(page, '/planner');
  await expect(page.getByTestId('planner-head')).toBeVisible();
  await page.waitForTimeout(1500);
  const plan = await planOf(page);
  facts(info, 'B', {
    kinds,
    teamDeadline,
    gamingTask,
    mondayKind,
    sundayKind,
    tasks: tasks.length,
    events: events.length,
    plan,
  });
  await record(info, m, name);
});

const OPEN = [
  'Arbeitszeit eintragen',
  'WhatsApp antworten',
  'Mails checken und beantworten',
  'Rechnungen aus den Mails übernehmen',
  'Bude aufräumen',
  'Duschen',
  'Pfand zusammenräumen',
  'Schlafrhythmus fixen',
];

test('C Wochenende einteilen', async ({ page, isMobile }, info) => {
  const name = 'C Wochenende einteilen';
  await prepare(
    page,
    ['todos', 'planner'],
    OPEN.map((title) => ({ title })),
  );
  const m = new Meter(page, isMobile);
  await m.go('/planner');
  await expect(page.getByTestId('planner-head')).toBeVisible();
  // Saturday: 2 h by default → about 6 h. The day sheet steps 30 min per tap.
  await openPlannerDay(page, m, isMobile, isMobile ? /^Heute/ : /^Heute · Sa/);
  const sheet = page.getByRole('dialog');
  await stepTo(m, sheet, '6 h');
  // The break: a blocker „Zocken“ of 2 h (without a time window it has no time of day).
  await m.type(sheet.getByLabel('Was blockt die Zeit?'), 'Zocken');
  await m.type(sheet.getByLabel('Dauer'), '120');
  await m.tap(sheet.getByRole('button', { name: 'Blocker hinzufügen' }));
  await expect(sheet.getByText('Zocken')).toBeVisible();
  await m.tap(sheet.getByRole('button', { name: 'Schließen' }).first());
  // Sunday is „frei“ (0 min) by default: about 4 h.
  await openPlannerDay(page, m, isMobile, /^So/);
  const sunday = page.getByRole('dialog');
  await stepTo(m, sunday, '4 h');
  await m.tap(sunday.getByRole('button', { name: 'Schließen' }).first());
  // W10: Sunday got time, but does it get things? Nothing moves onto it (rule 6): the weekend plan the person
  // meant does not happen – a detour (the person has to move things by hand or know „alles neu mischen“).
  const sundayRows = await settledCount(page.locator(`[data-testid="day-${SUNDAY}"] li`));
  if (sundayRows === 0) m.detour();
  // „Erst Pflicht, dann Freizeit, dann Haushalt“ has no place: neither a day part nor an order hint exists, so
  // the order inside the day stays priority → age (counted in ANALYSIS, not here).
  const plan = await planOf(page);
  facts(info, 'C', { ...plan, sundayRows });
  await record(info, m, name);
});

test('D Arbeitszeit nachtragen', async ({ page, isMobile }, info) => {
  const name = 'D Arbeitszeit nachtragen';
  test.skip(isMobile, 'measured on the PC (the phone path is the same dialog)');
  await prepare(page, []);
  const m = new Meter(page, false);
  // Zeiterfassung is off on a new install: library, switch, then the module.
  await m.nav(page.getByRole('link', { name: 'Modul-Bibliothek' }), /Modul-Bibliothek/);
  await m.tap(page.getByRole('switch', { name: 'Zeiterfassung einschalten' }));
  await m.nav(await sideLink(page, m, 'Zeiterfassung', 'Planen'), /Zeiterfassung/);
  await m.tap(page.getByRole('button', { name: 'Zeit eintragen', exact: true }).first());
  m.dialog();
  const dialog = page.getByRole('dialog');
  // Friday 09:00–17:00 (yesterday): date, start, end.
  await m.type(dialog.getByRole('textbox', { name: 'Datum' }), '13.11.2026');
  await m.type(dialog.getByRole('textbox', { name: 'Beginn' }), '09:00');
  await m.type(dialog.getByRole('textbox', { name: 'Ende' }), '17:00');
  await m.tap(dialog.getByRole('button', { name: 'Zeit eintragen', exact: true }));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const sessions = await rows<{ date?: string; start?: string; end?: string }>(
    page,
    'timetrack_session',
  );
  facts(info, 'D', { sessions: sessions.length });
  expect(sessions.length).toBe(1);
  await record(info, m, name);
});

test('E Mail: Persönlich, Suche, Rechnung, Antwort in den Plan', async ({
  page,
  isMobile,
}, info) => {
  const name = 'E Mail: Persönlich, Suche, Rechnung, Antwort in den Plan';
  test.skip(isMobile, 'mail is a desktop-only module');
  const seed = process.env.USECASE_SEED_URL;
  test.skip(
    !seed,
    'needs the demo mails of a seeded Dev-Preview: USECASE_SEED_URL=http://localhost:4174',
  );
  test.setTimeout(180_000);
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00')); // the seed's clock
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
  await expect(section.getByTestId('seed-status')).toContainText('2026-09-29', { timeout: 90_000 });
  await page.evaluate(
    (base) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          for (const id of ['mail', 'planner'])
            tx.objectStore('_modules').put({ ...base, id, enabled: true, dataPolicy: null });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    meta('x'),
  );
  const m = new Meter(page, false);
  m.screens += 1;
  await page.goto(`${seed}/mail`);
  await expect(page.getByText('Beispiel-Mails (Testdaten)')).toBeVisible();
  // „die wichtigen finden“: the chip „Persönlich“.
  const personal = page
    .getByRole('button', { name: 'Persönlich' })
    .or(page.getByRole('link', { name: 'Persönlich' }));
  const hasPersonal = (await personal.count()) > 0;
  if (hasPersonal) {
    await m.tap(personal.first());
    await page.waitForTimeout(500);
    await m.tap(personal.first()); // back to all mails for the search
  } else m.detour();
  // „nach einer bestimmten Mail suchen“: the search field.
  const search = page.getByRole('search').getByRole('combobox', { name: 'Suchen' });
  await m.type(search, 'Rechnung');
  await m.enter(search);
  await page.waitForTimeout(800);
  // The demo account never searches (useMailbox: searches go to Gmail only), so the result is recorded, not
  // asserted; with a real account the search runs on Gmail's side.
  const afterSearch = await page.locator('main').innerText();
  // The invoice from the mail, one tap (kopf-leer 3b).
  await page.goto(`${seed}/mail`);
  const invoice = page.getByRole('button', { name: /^Rechnung anlegen: Stadtwerke Musterstadt/ });
  await expect(invoice).toBeVisible({ timeout: 10_000 });
  await m.tap(invoice);
  await expect(page.getByText('Rechnung angelegt')).toBeVisible();
  // A reply as a plan thing, one tap (kopf-leer 3a).
  const reply = page.getByRole('button', { name: /^In den Plan: Anna Beispiel/ });
  await expect(reply).toBeVisible({ timeout: 10_000 });
  await m.tap(reply);
  await expect(page.getByText(/^Im Plan/).first()).toBeVisible();
  facts(info, 'E', {
    hasPersonal,
    searchFound: /Stadtwerke|Rechnung/.test(afterSearch),
  });
  await record(info, m, name);
});

test('F Abend: Rest auf andere Tage', async ({ page, isMobile }, info) => {
  const name = 'F Abend: Rest auf andere Tage';
  // Saturday 21:00: four open things on an empty install; the run puts three on today (limit of three main
  // items) and one on Monday; Sunday has its default 0, so „Später“ lands on Monday.
  await page.clock.setFixedTime(new Date(`${SATURDAY}T21:00:00`));
  await prepare(
    page,
    ['todos', 'planner'],
    ['Bude aufräumen', 'Duschen', 'Pfand zusammenräumen', 'WhatsApp antworten'].map((title) => ({
      title,
    })),
  );
  const m = new Meter(page, isMobile);
  await m.go('/planner');
  await expect(page.getByTestId('planner-head')).toBeVisible();
  await settledCount(page.locator(`[data-testid="day-${SATURDAY}"] li`));
  const before = await planOf(page);
  // „per Klick automatisch aufteilen“: the only run button is „Neu verteilen“ in the ⋯ menu.
  await m.tap(page.getByRole('button', { name: 'Weitere Optionen' }));
  await m.tap(
    page
      .getByRole('menuitem', { name: 'Neu verteilen' })
      .or(page.getByRole('button', { name: 'Neu verteilen' }))
      .first(),
  );
  // The run shows a preview first (inline); here it says nothing changes – today's free minutes still count.
  const apply = page.getByRole('button', { name: 'Übernehmen' });
  const nothing = page.getByText('Am Plan ändert sich nichts.');
  await expect(apply.or(nothing).first()).toBeVisible();
  m.dialog();
  if (await apply.isVisible()) {
    await m.tap(apply);
    await expect(apply).toBeHidden();
  }
  const today = page.locator(`[data-testid="day-${SATURDAY}"] li`);
  const stuck = await settledCount(today);
  const afterRun = await planOf(page);
  // The evening is over, but the run still uses today's free time: what stays on today is a detour, and the
  // person moves each thing by hand („Später“ = earliest tomorrow).
  if (stuck > 0) {
    m.detour();
    for (let i = 0; i < stuck; i += 1) {
      const row = page.locator(`[data-testid="day-${SATURDAY}"] li`).first();
      await m.tap(row.getByRole('button', { name: /^Aktionen für/ }));
      await m.tap(page.getByRole('menuitem', { name: 'Später' }));
      await expect(today).toHaveCount(stuck - i - 1);
    }
  }
  await expect(page.locator(`[data-testid="day-${SATURDAY}"] li`)).toHaveCount(0);
  facts(info, 'F', { before, afterRun, stuckOnToday: stuck });
  await record(info, m, name);
});

test('G Sonntag-Frist und Montag früh', async ({ page, isMobile }, info) => {
  const name = 'G Sonntag-Frist und Montag früh';
  test.skip(isMobile, 'measured on the PC');
  await prepare(page, ['todos', 'planner']);
  const m = new Meter(page, false);
  await m.go('/planner');
  // The planner's own field: „bis So“ makes a hard due – the 18:00 has nowhere to go.
  const field = page.getByRole('textbox', { name: 'Eintragen oder sagen' });
  await m.type(field, 'Team-Sachen lesen bis So 18:00');
  await m.enter(field);
  await expect(page.getByText(/Eingetragen/).first()).toBeVisible();
  const team = (
    await rows<{ title: string; dueDate?: string; plannedFor?: string; note?: string }>(
      page,
      'todos_task',
    )
  ).find((t) => /Team-Sachen/.test(t.title));
  // „bis So“ must give Sunday as the hard due; any other day is a detour the person has to find and fix.
  const dueRight = team?.dueDate === SUNDAY;
  if (!dueRight) m.detour();
  // The 18:00 has no field (no due time): at most a note line the plan never reads.
  const timeOnlyInNote = /18:00/.test(team?.note ?? '');
  // Sunday evening and Monday morning through the quick capture (one sheet, two lines).
  await m.tap(page.getByRole('button', { name: /Neu: etwas eintragen|Neu eintragen/ }));
  m.dialog();
  const input = page.getByRole('textbox', { name: 'Was möchtest du festhalten?' }).last();
  await m.type(input, 'So 19 Uhr erinnere mich kurz zu schauen\nMo 7:30 krankmelden falls nötig');
  await m.tap(page.getByRole('button', { name: 'Alle speichern (2)' }).first());
  await expect(page.getByText('2 Dinge gespeichert')).toBeVisible();
  const items = await rows<{
    title: string;
    kind?: string;
    startDate?: string;
    startTime?: string;
  }>(page, 'calendar_event');
  const sunday = items.find((i) => /schauen/i.test(i.title));
  const monday = items.find((i) => /krankmelden/i.test(i.title));
  // Monday's line becomes an appointment (it blocks an hour of the plan and reminds like a meeting).
  if ((monday?.kind ?? 'event') !== 'reminder') m.detour();
  facts(info, 'G', {
    team: {
      title: team?.title,
      dueDate: team?.dueDate,
      plannedFor: team?.plannedFor,
      note: team?.note,
    },
    dueRight,
    timeOnlyInNote,
    sunday: sunday && {
      kind: sunday.kind,
      startDate: sunday.startDate,
      startTime: sunday.startTime,
    },
    monday: monday && {
      kind: monday.kind,
      startDate: monday.startDate,
      startTime: monday.startTime,
    },
  });
  await record(info, m, name);
});

test('H Schlaf: Abendgrenze für den Plan', async ({ page, isMobile }, info) => {
  const name = 'H Schlaf: Abendgrenze für den Plan';
  test.skip(isMobile, 'measured on the PC');
  await prepare(page, ['todos', 'planner']);
  const m = new Meter(page, false);
  await m.go('/planner');
  // No sleep or bedtime setting exists; the nearest is the planner's time window per weekday (module settings).
  await m.nav(
    page.getByRole('link', { name: 'Dieses Modul anpassen' }).first(),
    /Planer|Einstellungen/,
  );
  const sat = page.getByLabel('Zeitfenster Samstag');
  await expect(sat).toBeVisible();
  await m.type(sat, '10-23');
  await m.tap(page.locator('main h1'));
  await m.type(page.getByLabel('Zeitfenster Sonntag'), '10-23');
  await m.tap(page.locator('main h1'));
  // The window is saved …
  await page.reload();
  await expect(page.getByLabel('Zeitfenster Samstag')).toHaveValue('10:00–23:00');
  // … but it gives times and is no limit: what does not fit before 23:00 still stays on the day without a time
  // (windows.ts). A detour while no „Tagesende“ exists that the plan respects (F6 adds it).
  const dayEnd = await page.getByLabel(/Tagesende/).count();
  if (dayEnd === 0) m.detour();
  facts(info, 'H', { window: await sat.inputValue(), dayEnd });
  await record(info, m, name);
});
