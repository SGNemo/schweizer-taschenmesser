import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { backSettled, dismissNotices, ready, showPreview } from '../helpers';

/**
 * The planner page in numbers: the baseline before the „Planer als Steckenpferd“ redesign
 * (docs/design/planner-hub/ANALYSIS-MEASURE.md) and, since package R1 „Der Tag als Blatt“
 * (docs/design/planner-hub/HANDOFF.md §9), its targets as assertions. Two kinds of numbers, both written to
 * `test-results/usecase-planner-hub.md` (facts as JSON in `test-results/usecase-planner-hub/`):
 *
 * 1. **Click paths** (the house pattern of `wochenende.spec.ts`): taps, typed characters, screens, dialogs and
 *    detours (an action that did not do what the person meant, or a control the person looks for and that is not
 *    there) with the same seconds model (tap 1 s, character 0,25 s keyboard / 0,4 s phone, screen 2 s, dialog 3 s,
 *    detour 5 s). `MAX` held what `develop` 6ef3a2cb measured on 2026-11-15; R1 lowered it to what it measures
 *    (the baseline stands in the comment of each line); the next packages lower it, nobody raises it.
 * 2. **Design measures** of the first screen at 1920 × 1080 and 412 × 915, light and dark. The R1 targets are
 *    asserted on the screen the page opens on (`TARGET`); everything else is recorded with loose sanity checks.
 *
 * The scene is the maintainer's Sunday: 2026-11-15, an empty install with ToDos, Rechnungen and Planer on, three
 * ToDos (35 + 30 + 30 min) and six open invoices that were due on the Sunday, Tuesday and Thursday before. The
 * planner's defaults (Sunday 0 min, weekday 4 h less 20 % buffer) put all nine on Monday and leave 37 min free
 * there. Since R1 the page opens on that Monday (the first day that holds things). Made-up data only; rows go straight into IndexedDB, as in `wochenende.spec.ts`.
 *
 * How the design measures are taken (`measure`, in the page):
 * - **Content area** = the part of the first screen that belongs to the page: `main`'s box, below the module head
 *   (`module-frame`) and above the phone's bottom bar. Sidebar, top bar and head are not part of it.
 * - **Ink** = the area covered by visible text (the line boxes of every text node) and by controls and graphics
 *   (`input`, `select`, `textarea`, `svg`, `img`, progress bars). **Painted** = ink plus every element with a
 *   background of its own (cards, chips, fields, buttons). **Empty** = 1 − painted. All three are counted on a
 *   4-px grid, clipped to the content area, so overlapping boxes count once. `inkRight` is the same ink share for
 *   the right half of the area alone.
 * - **Used width** = from the leftmost to the rightmost ink in the content area, against the window width.
 * - **Font sizes** = `getComputedStyle(parent).fontSize` of every visible text node in `main` (head included).
 * - **Stimulus** = distinct text colours, distinct background colours and how many of all of them are chromatic
 *   (channel spread > 40), plus the number of controls and icons on the first screen.
 * - **Targets** = visible controls in the content area whose hit box (probed with `elementFromPoint`, so an
 *   enlarged pseudo-element counts) is narrower or lower than 44 px. A control the fold cuts is not counted (R1:
 *   its box is whole, the screen ends in it).
 * - **Overdue rows** = rows saying „Frist war …“: the day they sit on, their colour, its contrast on the row.
 *
 * Run (from `web/`; the app build is served on 4173):
 *   E2E_SEED=0 npx playwright test e2e/usecases/planner-hub.spec.ts --trace off
 * With `PLANNER_HUB_SHOTS=1` every measured screen is saved as a JPEG to `.screens/planner-hub/` (gitignored).
 * The test „S“ needs the demo data of the Dev-Preview flavour (as in wochenende path E):
 *   npm run build:e2e-seed && npm run preview:e2e-seed   (port 4174)
 *   USECASE_SEED_URL=http://localhost:4174 … --project=desktop-chrome
 * Without the variable it is skipped.
 */

const OUT = 'test-results/usecase-planner-hub';
const TABLE = 'test-results/usecase-planner-hub.md';
const SHOTS = '.screens/planner-hub';
const SUNDAY = '2026-11-15';
const MONDAY = '2026-11-16';
const WEDNESDAY = '2026-11-18';
const DESKTOP = { width: 1920, height: 1080 };
const PHONE = { width: 412, height: 915 };

type Metric = 'taps' | 'keys' | 'screens' | 'dialogs' | 'detours';
type Row = { name: string; project: string } & Record<Metric, number> & {
    seconds: number;
    ms: number;
  };

/**
 * Upper bounds per path. Measured on `develop` 6ef3a2cb (2026-11-15) and lowered by R1 to what the sheet measures
 * (the page opens on the day with things: no tap on a day; the title opens the source: no ⋯ → „Öffnen“). The
 * trailing comment is the baseline before R1. The redesign packages lower these; never raise them.
 */
const MAX: Record<string, Record<Metric | 'seconds', number>> = {
  // before R1: 2 taps, 4 s
  // prettier-ignore
  'A Ding abhaken · desktop-chrome': { taps: 1, keys: 0, screens: 1, dialogs: 0, detours: 0, seconds: 3 },
  // as before R1: the fold of „Danach“ takes the tap the day took
  // prettier-ignore
  'A Ding abhaken · pixel-7': { taps: 2, keys: 0, screens: 1, dialogs: 0, detours: 0, seconds: 4 },
  // B: the sentence moves the thing and „Später“ moves a thing of tomorrow since fix/plan-move-sentence (P08, P09).
  // prettier-ignore
  'B Ding auf einen anderen Tag · desktop-chrome': { taps: 4, keys: 29, screens: 1, dialogs: 1, detours: 1, seconds: 21 },
  // prettier-ignore
  'B Ding auf einen anderen Tag · pixel-7': { taps: 4, keys: 29, screens: 1, dialogs: 1, detours: 1, seconds: 26 },
  // before R1: 3 taps, 10 s
  // prettier-ignore
  'C1 Quelle öffnen: ToDo · desktop-chrome': { taps: 1, keys: 0, screens: 2, dialogs: 1, detours: 0, seconds: 8 },
  // before R1: 3 taps, 10 s
  // prettier-ignore
  'C1 Quelle öffnen: ToDo · pixel-7': { taps: 2, keys: 0, screens: 2, dialogs: 1, detours: 0, seconds: 9 },
  // before R1: 3 taps, 10 s
  // prettier-ignore
  'C2 Quelle öffnen: Rechnung · desktop-chrome': { taps: 1, keys: 0, screens: 2, dialogs: 1, detours: 0, seconds: 8 },
  // before R1: 3 taps, 10 s
  // prettier-ignore
  'C2 Quelle öffnen: Rechnung · pixel-7': { taps: 1, keys: 0, screens: 2, dialogs: 1, detours: 0, seconds: 8 },
  // before R1: 3 taps, 7 s
  // prettier-ignore
  'C3 Quelle öffnen: Mail · desktop-chrome': { taps: 2, keys: 0, screens: 2, dialogs: 0, detours: 0, seconds: 6 },
  // as before R1
  // prettier-ignore
  'D Rest verteilen · desktop-chrome': { taps: 2, keys: 0, screens: 1, dialogs: 1, detours: 0, seconds: 7 },
  // as before R1
  // prettier-ignore
  'D Rest verteilen · pixel-7': { taps: 2, keys: 0, screens: 1, dialogs: 1, detours: 0, seconds: 7 },
  // as before R1
  // prettier-ignore
  'E Ding über das Planer-Feld · desktop-chrome': { taps: 0, keys: 14, screens: 1, dialogs: 0, detours: 0, seconds: 6 },
  // as before R1
  // prettier-ignore
  'E Ding über das Planer-Feld · pixel-7': { taps: 0, keys: 14, screens: 1, dialogs: 0, detours: 0, seconds: 8 },
  // before R1: 6 taps, 20 s
  // prettier-ignore
  'F Überfällige Rechnung begleichen · desktop-chrome': { taps: 4, keys: 0, screens: 3, dialogs: 1, detours: 1, seconds: 18 },
  // before R1: 6 taps, 20 s
  // prettier-ignore
  'F Überfällige Rechnung begleichen · pixel-7': { taps: 4, keys: 0, screens: 3, dialogs: 1, detours: 1, seconds: 18 },
};

/** The targets of R1 (HANDOFF §9) on the screen the page opens on, per window. */
const TARGET = {
  /** 1920: at most a quarter of the content area is unpainted (71 % before). */
  emptyShare: 0.25,
  /** 1920: thing rows in full on the first screen (0 before) … */
  rowsOnScreen: 8,
  /** … and thing rows that at least begin on it (3 „Zuerst“ + 6 „Danach“). */
  rowsBegun: 9,
  /** 1920: the field's top edge (567 before). */
  fieldY: 260,
  /** 412: controls with a hit box under 44 px (12 of 20 before). */
  smallTargets: 0,
  /** Both: distinct font sizes in `main` (HANDOFF §10 Q4: 8 with the unchanged shared parts). */
  fontSizes: 8,
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
  /** A new screen reached through a tap (counted as tap + screen). */
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
  /** The browser's or the phone's Back: one tap, one screen. */
  async back(h1: RegExp) {
    this.taps += 1;
    this.screens += 1;
    await backSettled(this.page);
    await this.page.goBack();
    await expect(this.page.locator('main h1')).toContainText(h1);
  }
  /** Putting an open menu away without picking from it: one tap (beside it, or Escape). */
  async closeMenu() {
    this.taps += 1;
    await this.page.keyboard.press('Escape');
    await expect(this.page.getByRole('menuitem')).toHaveCount(0);
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

type Measure = Awaited<ReturnType<typeof measure>>;
type DesignRow = { screen: string; project: string; scheme: string; m: Measure };

const pct = (share: number) => `${Math.round(share * 100)} %`;
const px = (n: number | null) => (n === null ? '–' : `${Math.round(n)}`);

function readRows<T>(prefix: string): T[] {
  return readdirSync(OUT)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')) as T);
}

function writeTable() {
  const paths = readRows<Row>('path-');
  const designs = readRows<DesignRow>('design-');
  const out = [
    '## Click paths',
    '',
    '| Path | Project | Taps | Keys | Screens | Dialogs | Detours | ≈ s (person) | ms (machine) |',
    '|---|---|---|---|---|---|---|---|---|',
    ...paths.map(
      (r) =>
        `| ${r.name} | ${r.project} | ${r.taps} | ${r.keys} | ${r.screens} | ${r.dialogs} | ${r.detours} | ${r.seconds} | ${r.ms} |`,
    ),
    '',
    '## Design measures (first screen)',
    '',
    '| Screen | Project | Scheme | Window | Ink | Painted | Empty | Ink right half | Used width | Empty below (px) | First thing y | Things on screen / all | Thing row h | Field y · w × h | Font sizes | Title / meta / head px | Text / bg colours (chromatic) | Controls · icons | Targets < 44 px | Overdue rows: day · colour · contrast |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...designs.map(({ screen, project, scheme, m }) =>
      [
        `| ${screen}`,
        project,
        scheme,
        `${m.window.w} × ${m.window.h}`,
        pct(m.coverage.ink),
        pct(m.coverage.painted),
        pct(m.coverage.empty),
        pct(m.coverage.inkRight),
        `${px(m.width.used)} (${pct(m.width.used / m.window.w)})`,
        px(m.coverage.emptyBelow),
        px(m.rows.firstY),
        `${m.rows.onScreen} / ${m.rows.all}`,
        px(m.rows.height),
        m.field ? `${px(m.field.y)} · ${px(m.field.w)} × ${px(m.field.h)}` : '–',
        `${m.fonts.sizes.length}: ${m.fonts.sizes.map((s) => s.px).join(', ')}`,
        `${px(m.fonts.rowTitle)} / ${px(m.fonts.rowMeta)} / ${px(m.fonts.head)}`,
        `${m.stimulus.textColours} / ${m.stimulus.bgColours} (${m.stimulus.chromatic})`,
        `${m.stimulus.controls} · ${m.stimulus.icons}`,
        `${m.targets.small.length} of ${m.targets.all}`,
        m.overdue.rows
          ? `${m.overdue.rows} on ${m.overdue.days.join(', ')} · ${m.overdue.colour} · ${m.overdue.contrast}:1 |`
          : '– |',
      ].join(' | '),
    ),
  ].join('\n');
  // Temp file + rename: workers run in parallel and a half-written file must never be read.
  const tmp = `${OUT}/table.${process.pid}.tmp`;
  writeFileSync(tmp, `${out}\n`);
  renameSync(tmp, TABLE);
}

function save(file: string, data: unknown) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 1));
  renameSync(`${file}.tmp`, file);
}

function facts(info: TestInfo, key: string, data: unknown) {
  save(`${OUT}/${key}-${info.project.name}-facts.json`, data);
  info.annotations.push({ type: 'facts', description: `${key}: ${JSON.stringify(data)}` });
}

async function record(info: TestInfo, meter: Meter, name: string) {
  const project = info.project.name;
  const row = meter.row(name, project);
  save(`${OUT}/path-${name.split(' ')[0]}-${project}.json`, row);
  writeTable();
  await info.attach('usecase-planner-hub', { path: TABLE });
  info.annotations.push({
    type: 'usecase',
    description: `${name}: ${row.taps} taps · ${row.keys} keys · ${row.screens} screens · ${row.dialogs} dialogs · ${row.detours} detours · ≈ ${row.seconds} s`,
  });
  const max = MAX[`${name} · ${project}`];
  expect(max, `no baseline for „${name}“ on ${project}`).toBeTruthy();
  for (const k of ['taps', 'keys', 'screens', 'dialogs', 'detours', 'seconds'] as const)
    expect(row[k], `${name}: ${k} (bound ${max![k]})`).toBeLessThanOrEqual(max![k]);
}

const meta = (id: string) => ({
  id,
  createdAt: 1,
  updatedAt: 1,
  deviceId: 'e2e',
  deletedAt: null,
  _f: {},
});

const TODOS = [
  { title: 'Steuerunterlagen sortieren', estimateMin: 35 },
  { title: 'Wohnung saugen', estimateMin: 30 },
  { title: 'Angebot Fahrradladen prüfen', estimateMin: 30 },
];
/** Six open invoices: two each were due on the Sunday, the Tuesday and the Thursday before. */
const INVOICES = [
  { payee: 'Stadtwerke Musterstadt', dueDate: '2026-11-08' },
  { payee: 'Zahnarzt Dr. Beispiel', dueDate: '2026-11-08' },
  { payee: 'Musterversicherung', dueDate: '2026-11-10' },
  { payee: 'Kfz-Werkstatt Muster', dueDate: '2026-11-10' },
  { payee: 'Telefon Beispielnetz', dueDate: '2026-11-12' },
  { payee: 'Schornsteinfeger Muster', dueDate: '2026-11-12' },
];

/**
 * An empty install with the planner and its sources switched on (what the switches in the library write).
 * `week`: the three ToDos and six overdue invoices of the scene; `empty`: nothing. `mail` also switches the mail
 * module on and hangs a mail link on the third ToDo (what „In den Plan“ in the mail list writes).
 */
async function prepare(page: Page, scene: 'week' | 'empty', opts: { mail?: boolean } = {}) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    ({ scene, mail, todos, invoices, base }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(
            ['_modules', 'todos_list', 'todos_task', 'invoices_invoice'],
            'readwrite',
          );
          const modules = ['todos', 'planner', ...(scene === 'week' ? ['invoices'] : [])];
          for (const id of [...modules, ...(mail ? ['mail'] : [])])
            tx.objectStore('_modules').put({ ...base, id, enabled: true, dataPolicy: null });
          if (scene === 'week') {
            tx.objectStore('todos_list').put({ ...base, id: 'inbox', name: 'Eingang', order: 0 });
            todos.forEach((t, i) =>
              tx.objectStore('todos_task').put({
                ...base,
                id: `p${i}`,
                listId: 'inbox',
                done: false,
                priority: 0,
                order: i,
                ...t,
                ...(mail && i === 2
                  ? { links: [{ kind: 'mail', id: 'demo-thread', label: 'Angebot' }] }
                  : {}),
              }),
            );
            invoices.forEach((inv, i) =>
              tx.objectStore('invoices_invoice').put({
                ...base,
                id: `inv${i}`,
                amountMinor: 4200 + i * 1375,
                status: 'open',
                ...inv,
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
    { scene, mail: opts.mail === true, todos: TODOS, invoices: INVOICES, base: meta('x') },
  );
}

/** Rows of one store (not deleted). */
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

/** The number of rows a locator finds once the planner run has settled (two reads 400 ms apart agree). */
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

const day = (page: Page, date: string) => page.locator(`[data-testid="day-${date}"]`);
const things = (page: Page, date: string) => day(page, date).locator('li');

/** The control that shows another day: its tile in the week band (at every width). */
function dayPick(page: Page, date: string) {
  return page.getByRole('group', { name: 'Woche' }).getByTestId(`week-${date}`);
}

/** What the page says: the head, the week (the tiles' names) and the titles on the shown day. */
async function boardOf(page: Page) {
  return page.evaluate(() => {
    const text = (e: Element | null) =>
      (e as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim();
    const shown = document.querySelector('main [data-testid^="day-"]');
    return {
      head: text(document.querySelector('[data-testid="planner-head"]')),
      headDetail: text(
        document.querySelector('[data-testid="planner-head"]')?.nextElementSibling ?? null,
      ),
      shownDay: shown?.getAttribute('data-testid'),
      shown: Array.from(shown?.querySelectorAll('li') ?? []).map((li) => text(li)),
      week: Array.from(document.querySelectorAll('main [aria-label="Woche"] button .sr-only')).map(
        (e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim(),
      ),
    };
  });
}

/** The first screen of the planner in numbers; the method is described in the file's head comment. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const CELL = 4;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const main = document.querySelector('main')!;
    const mainBox = main.getBoundingClientRect();
    const frame = document.querySelector('[data-testid="module-frame"]');
    const frameBox = frame?.getBoundingClientRect();
    // The phone's bottom bar: a navigation across the window's lower edge.
    const bottomBar = Array.from(document.querySelectorAll('nav'))
      .map((n) => n.getBoundingClientRect())
      .find((r) => r.width > vw * 0.9 && r.top > vh / 2 && r.height > 0);
    const area = {
      left: Math.max(0, mainBox.left),
      right: Math.min(vw, mainBox.right),
      top: Math.max(0, frameBox?.bottom ?? mainBox.top),
      bottom: Math.min(vh, bottomBar?.top ?? vh),
    };
    const cols = Math.max(1, Math.ceil((area.right - area.left) / CELL));
    const lines = Math.max(1, Math.ceil((area.bottom - area.top) / CELL));
    const grid = () => new Uint8Array(cols * lines);
    const ink = grid();
    const painted = grid();
    const mark = (
      g: Uint8Array,
      r: { left: number; right: number; top: number; bottom: number },
    ) => {
      const x0 = Math.max(0, Math.floor((r.left - area.left) / CELL));
      const x1 = Math.min(cols, Math.ceil((r.right - area.left) / CELL));
      const y0 = Math.max(0, Math.floor((r.top - area.top) / CELL));
      const y1 = Math.min(lines, Math.ceil((r.bottom - area.top) / CELL));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y * cols + x] = 1;
    };
    const share = (g: Uint8Array, fromCol = 0) => {
      let n = 0;
      for (let y = 0; y < lines; y++) for (let x = fromCol; x < cols; x++) n += g[y * cols + x]!;
      return n / ((cols - fromCol) * lines);
    };
    const visible = (el: Element) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return (
        el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) &&
        r.width > 1 &&
        r.height > 1 &&
        s.clipPath === 'none' &&
        !el.closest('.sr-only')
      );
    };
    const rgb = (value: string): [number, number, number, number] | undefined => {
      const m = /rgba?\(([^)]+)\)/.exec(value);
      if (m) {
        const p = m[1]!.split(/[\s,/]+/).map(Number);
        return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
      }
      const c = /color\(srgb ([^)]+)\)/.exec(value);
      if (c) {
        const p = c[1]!.split(/[\s/]+/).map(Number);
        return [p[0]! * 255, p[1]! * 255, p[2]! * 255, p[3] ?? 1];
      }
      return undefined;
    };
    const hex = (c: [number, number, number, number]) =>
      `#${c
        .slice(0, 3)
        .map((v) => Math.round(v).toString(16).padStart(2, '0'))
        .join('')}`;
    /** The colour behind an element: the nearest opaque backgrounds, blended from the page up. */
    const backdrop = (el: Element): [number, number, number, number] => {
      const stack: [number, number, number, number][] = [];
      for (let e: Element | null = el; e; e = e.parentElement) {
        const c = rgb(getComputedStyle(e).backgroundColor);
        if (c && c[3] > 0) {
          stack.push(c);
          if (c[3] >= 1) break;
        }
      }
      let out: [number, number, number, number] = [255, 255, 255, 1];
      for (const c of stack.reverse())
        out = [
          c[0] * c[3] + out[0] * (1 - c[3]),
          c[1] * c[3] + out[1] * (1 - c[3]),
          c[2] * c[3] + out[2] * (1 - c[3]),
          1,
        ];
      return out;
    };
    const luminance = (c: [number, number, number, number]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const contrast = (el: Element) => {
      const fg = rgb(getComputedStyle(el).color);
      if (!fg) return 0;
      const a = luminance(fg);
      const b = luminance(backdrop(el));
      return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10;
    };
    const inArea = (r: DOMRect) =>
      r.right > area.left && r.left < area.right && r.bottom > area.top && r.top < area.bottom;

    // Text: every visible text node of `main`, with the line boxes it paints.
    const sizes = new Map<number, number>();
    const textColours = new Set<string>();
    const bgColours = new Set<string>();
    let inkLeft = Infinity;
    let inkRight = -Infinity;
    let inkBottom = area.top;
    const inkRect = (r: DOMRect) => {
      if (!inArea(r)) return;
      mark(ink, r);
      mark(painted, r);
      inkLeft = Math.min(inkLeft, Math.max(r.left, area.left));
      inkRight = Math.max(inkRight, Math.min(r.right, area.right));
      inkBottom = Math.max(inkBottom, Math.min(r.bottom, area.bottom));
    };
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const parent = n.parentElement;
      if (!parent || !n.textContent?.trim() || !visible(parent)) continue;
      range.selectNodeContents(n);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      if (!rects.some((r) => r.bottom > 0 && r.top < vh)) continue;
      const style = getComputedStyle(parent);
      const size = Math.round(parseFloat(style.fontSize) * 10) / 10;
      sizes.set(size, (sizes.get(size) ?? 0) + 1);
      const colour = rgb(style.color);
      if (colour) textColours.add(hex(colour));
      rects.forEach(inkRect);
    }
    // Controls and graphics count as ink; anything with a background of its own as painted.
    let icons = 0;
    for (const el of Array.from(main.querySelectorAll('*'))) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (!(r.bottom > 0 && r.top < vh)) continue;
      const bg = rgb(getComputedStyle(el).backgroundColor);
      if (el.matches('input, select, textarea, svg, img, [role="progressbar"]')) {
        inkRect(r);
        if (el.matches('svg, img')) icons += 1;
      }
      if (bg && bg[3] > 0.05) {
        bgColours.add(hex(backdrop(el)));
        if (!frame?.contains(el) && inArea(r)) mark(painted, r);
      }
    }
    const chromatic = [...textColours, ...bgColours].filter((h) => {
      const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      return Math.max(...v) - Math.min(...v) > 40;
    }).length;

    // Controls and their hit boxes.
    const hitBox = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const hits = (x: number, y: number) => {
        const at = document.elementFromPoint(x, y);
        return !!at && (at === el || el.contains(at));
      };
      if (!hits(cx, cy)) return { w: Math.round(r.width), h: Math.round(r.height) };
      const reach = (dx: number, dy: number) => {
        let d = 0;
        while (d < 60 && hits(cx + dx * (d + 1), cy + dy * (d + 1))) d += 1;
        return d;
      };
      return { w: reach(-1, 0) + reach(1, 0) + 1, h: reach(0, -1) + reach(0, 1) + 1 };
    };
    const controls = Array.from(
      main.querySelectorAll('button, a[href], input, select, textarea, [role="button"], summary'),
    ).filter((el) => visible(el) && inArea(el.getBoundingClientRect()));
    const name = (el: Element) =>
      (
        el.getAttribute('aria-label') ??
        (el as HTMLElement).innerText ??
        el.getAttribute('placeholder') ??
        el.tagName
      )
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40);
    const targets = controls
      .filter((el) => !frame?.contains(el))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          name: name(el),
          tag: el.tagName.toLowerCase(),
          ...hitBox(el),
          // Cut by the fold (or by the head): its hit box is whole, only not all of it is on this screen.
          cut: r.bottom > area.bottom || r.top < area.top,
        };
      });

    // The things: rows of the shown day.
    const thingRows = Array.from(main.querySelectorAll('[data-testid^="day-"] li'));
    const boxes = thingRows.map((li) => li.getBoundingClientRect());
    const first = thingRows[0];
    const fontOf = (el: Element | null | undefined) =>
      el ? Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10 : null;
    const title = first?.querySelector('[data-row] > span');
    const metaLine = first?.querySelector('[data-row] > span + span');
    const head = document.querySelector('[data-testid="planner-head"]');
    const headBox = head?.getBoundingClientRect();
    // A tile of the week band; its visible form (wide or compact) carries the day and the state line.
    const weekRow = main.querySelector('[aria-label="Woche"] button');
    const tileForm = Array.from(
      weekRow?.querySelectorAll(':scope > span[aria-hidden="true"]') ?? [],
    ).find((el) => visible(el) && el.querySelector('span'));
    const chip = weekRow;

    // The capture field.
    const form = main.querySelector('form');
    const input = form?.querySelector('input');
    const inputBox = input?.getBoundingClientRect();
    const formBox = form?.getBoundingClientRect();
    const weekBox = main.querySelector('[aria-label="Woche"]')?.getBoundingClientRect();

    // Overdue rows.
    const late = thingRows.filter((li) => /Frist war/.test((li as HTMLElement).innerText));
    const lateWord = late[0]
      ? Array.from(late[0].querySelectorAll('span')).find(
          (s) => /Frist war/.test(s.textContent ?? '') && s.children.length === 0,
        )
      : undefined;
    const lateColour = lateWord ? rgb(getComputedStyle(lateWord).color) : undefined;

    return {
      window: { w: vw, h: vh },
      area: {
        x: Math.round(area.left),
        y: Math.round(area.top),
        w: Math.round(area.right - area.left),
        h: Math.round(area.bottom - area.top),
      },
      coverage: {
        ink: share(ink),
        painted: share(painted),
        empty: 1 - share(painted),
        inkRight: share(ink, Math.floor(cols / 2)),
        paintedRight: share(painted, Math.floor(cols / 2)),
        /** Height of the band under the last ink, down to the end of the content area. */
        emptyBelow: Math.round(area.bottom - inkBottom),
      },
      width: {
        used: inkRight > inkLeft ? Math.round(inkRight - inkLeft) : 0,
        main: Math.round(mainBox.width),
        left: Math.round(inkLeft),
        right: Math.round(inkRight),
      },
      head: {
        text: (head as HTMLElement | null)?.innerText ?? null,
        x: headBox ? Math.round(headBox.left) : null,
        y: headBox ? Math.round(headBox.top) : null,
        w: headBox ? Math.round(headBox.width) : null,
        weight: head ? getComputedStyle(head).fontWeight : null,
        frameHeight: frameBox ? Math.round(frameBox.height) : null,
      },
      rows: {
        all: thingRows.length,
        onScreen: boxes.filter((r) => r.top >= area.top && r.bottom <= area.bottom).length,
        /** Rows whose top edge lies on the first screen (the last one may be cut by the fold). */
        begun: boxes.filter((r) => r.height > 0 && r.top >= area.top && r.top < area.bottom).length,
        firstY: boxes[0] ? Math.round(boxes[0].top) : null,
        height: boxes[0] ? Math.round(boxes[0].height) : null,
        weekRowHeight: weekRow ? Math.round(weekRow.getBoundingClientRect().height) : null,
        chip: chip
          ? {
              w: Math.round(chip.getBoundingClientRect().width),
              h: Math.round(chip.getBoundingClientRect().height),
            }
          : null,
        withTick: thingRows.filter((li) => li.querySelector('input[type="checkbox"]')).length,
        titleContrast: title ? contrast(title) : null,
        metaContrast: metaLine ? contrast(metaLine.querySelector('span span') ?? metaLine) : null,
      },
      field: inputBox
        ? {
            x: Math.round(inputBox.left),
            y: Math.round(inputBox.top),
            w: Math.round(inputBox.width),
            h: Math.round(inputBox.height),
            formY: formBox ? Math.round(formBox.top) : null,
            onScreen: inputBox.bottom <= area.bottom,
            underWeek: weekBox ? inputBox.top >= weekBox.bottom : null,
            underThings: boxes.length ? inputBox.top >= boxes[boxes.length - 1]!.bottom : null,
            font: fontOf(input),
            labelFont: fontOf(form?.querySelector('label')),
          }
        : null,
      fonts: {
        sizes: [...sizes.entries()].sort((a, b) => a[0] - b[0]).map(([px, n]) => ({ px, n })),
        rowTitle: fontOf(title),
        rowMeta: fontOf(metaLine?.querySelector('span span') ?? metaLine),
        head: fontOf(head),
        headDetail: fontOf(head?.nextElementSibling),
        h1: fontOf(main.querySelector('h1')),
        weekTitle: fontOf(tileForm?.querySelector('span span') ?? tileForm?.querySelector('span')),
        weekMeta: fontOf(tileForm?.querySelector(':scope > span:last-child')),
        chip: fontOf(chip),
      },
      stimulus: {
        textColours: textColours.size,
        bgColours: bgColours.size,
        chromatic,
        colours: { text: [...textColours].sort(), bg: [...bgColours].sort() },
        controls: controls.length,
        icons,
      },
      targets: {
        all: targets.length,
        small: targets.filter((t) => !t.cut && (t.w < 44 || t.h < 44)),
      },
      overdue: {
        rows: late.length,
        days: [
          ...new Set(
            late.map((li) =>
              (li.closest('[data-testid^="day-"]')?.getAttribute('data-testid') ?? '').slice(4),
            ),
          ),
        ],
        firstY: late[0] ? Math.round(late[0].getBoundingClientRect().top) : null,
        colour: lateColour ? hex(lateColour) : null,
        contrast: lateWord ? contrast(lateWord) : null,
        /** A group of its own („Überfällig“) anywhere on the page. */
        ownGroup: /Überfällig/.test(main.innerText),
      },
    };
  });
}

/** Measures the open page under `scheme`, stores the row and (with `PLANNER_HUB_SHOTS`) a picture. */
async function design(page: Page, info: TestInfo, screen: string, scheme: 'dark' | 'light') {
  await page.emulateMedia({ colorScheme: scheme });
  // The board is there (a page without things has no head figure: the band is what always comes with it).
  await expect(page.getByRole('group', { name: 'Woche' })).toBeVisible();
  await page.mouse.move(0, 0); // no hover state in the numbers
  const m = await measure(page);
  const project = info.project.name;
  const slug = `${screen.split(' ')[0]}-${project}-${scheme}`;
  save(`${OUT}/design-${slug}.json`, { screen, project, scheme, m } satisfies DesignRow);
  writeTable();
  if (process.env.PLANNER_HUB_SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({
      path: `${SHOTS}/${slug}.jpg`,
      type: 'jpeg',
      quality: 75,
      scale: 'css',
    });
  }
  // Loose sanity only: the page is there and the numbers are numbers.
  expect(m.coverage.painted).toBeGreaterThan(0.01);
  expect(m.coverage.painted).toBeLessThanOrEqual(1);
  expect(m.fonts.sizes.length).toBeGreaterThan(1);
  expect(m.fonts.sizes.length).toBeLessThan(25);
  expect(m.width.used).toBeGreaterThan(100);
  return m;
}

test.beforeEach(async ({ page, isMobile }) => {
  await page.setViewportSize(isMobile ? PHONE : DESKTOP);
  await page.clock.setFixedTime(new Date(`${SUNDAY}T10:00:00`));
  await dismissNotices(page);
});

test('A Ding abhaken', async ({ page, isMobile }, info) => {
  const name = 'A Ding abhaken';
  await prepare(page, 'week');
  const m = new Meter(page, isMobile);
  await m.go('/planner');
  await expect(page.getByTestId('planner-head')).toBeVisible();
  // The page opens on the first day that holds things (Monday; today, Sunday, is free): the nine things are there
  // without a tap, and the tile says so.
  await expect(things(page, MONDAY)).not.toHaveCount(0);
  await expect(dayPick(page, MONDAY)).toHaveAttribute('aria-pressed', 'true');
  await expect(dayPick(page, SUNDAY)).toHaveAttribute('aria-current', 'date');
  const onLanding = await settledCount(page.locator('main [data-testid^="day-"] li'));
  expect(onLanding).toBe(isMobile ? 3 : 9);
  const before = onLanding;
  // „Danach“ is folded on the phone: its rows are one tap away there (counted).
  const tick = day(page, MONDAY).getByRole('checkbox', {
    name: 'Erledigt: Wohnung saugen',
    exact: true,
  });
  if (!(await tick.isVisible()))
    await m.tap(day(page, MONDAY).getByRole('button', { name: /^Danach/ }));
  await m.tap(tick);
  await expect(day(page, MONDAY).getByText('Wohnung saugen')).toHaveCount(0);
  // Said for screen readers too (the status line), next to the undo toast.
  await expect(page.getByTestId('planner-status')).toHaveText('Erledigt: Wohnung saugen');
  const done = (await rows<{ title: string; done: boolean }>(page, 'todos_task')).find(
    (t) => t.title === 'Wohnung saugen',
  )?.done;
  expect(done).toBe(true);
  facts(info, 'A', { thingsOnLanding: onLanding, mondayBefore: before, ...(await boardOf(page)) });
  await record(info, m, name);
});

test('B Ding auf einen anderen Tag', async ({ page, isMobile }, info) => {
  const name = 'B Ding auf einen anderen Tag';
  // The person wants „Wohnung saugen“ on Wednesday instead of Monday.
  await prepare(page, 'week');
  const m = new Meter(page, isMobile);
  await m.go('/planner');
  await expect(things(page, MONDAY)).not.toHaveCount(0);
  await settledCount(things(page, MONDAY));
  // „Danach“ is folded on the phone: the thing is in it (one tap, counted).
  const actions = day(page, MONDAY).getByRole('button', {
    name: 'Aktionen für Wohnung saugen',
    exact: true,
  });
  if (!(await actions.isVisible()))
    await m.tap(day(page, MONDAY).getByRole('button', { name: /^Danach/ }));
  // First look: the row's ⋯. It names no other day („Später“ means tomorrow, „Festnageln auf Mo“ the day it is on;
  // „Verschieben …“ is package R2).
  await m.tap(actions);
  await expect(page.getByRole('menuitem').first()).toBeVisible();
  const menu = await page.getByRole('menuitem').allInnerTexts();
  const menuMoves = menu.some((item) => /\b(Mi|Mittwoch|Verschieben|Anderer Tag)\b/.test(item));
  if (!menuMoves) {
    m.detour();
    await m.closeMenu();
  }
  // The way that exists: a sentence in the field, its preview, „Übernehmen“.
  const field = page.getByRole('textbox', { name: 'Eintragen oder sagen' });
  const fieldBox = await field.boundingBox();
  await m.type(field, 'schieb Wohnung saugen auf Mi');
  await m.enter(field);
  const preview = page.getByTestId('plan-preview');
  await expect(preview).toBeVisible();
  m.dialog();
  const previewText = (await preview.innerText()).replace(/\s+/g, ' ').trim();
  await m.tap(preview.getByRole('button', { name: 'Übernehmen' }));
  await expect(preview).toHaveCount(0);
  // Where is it now? Looking at Wednesday is not counted; a thing that did not move is a detour.
  await page.waitForTimeout(1500);
  await settledCount(things(page, MONDAY));
  const stillMonday = await day(page, MONDAY).getByText('Wohnung saugen').count();
  await dayPick(page, WEDNESDAY).click();
  await expect(day(page, WEDNESDAY)).toBeVisible();
  await settledCount(things(page, WEDNESDAY));
  const onWednesday = await day(page, WEDNESDAY).getByText('Wohnung saugen').count();
  if (onWednesday === 0) m.detour();
  const pinned = (
    await rows<{ id: string; pinned?: string; source?: { id: string } }>(page, 'planner_item')
  ).find((r) => r.source?.id === 'p1')?.pinned;
  // „Später“ on a thing of tomorrow (the taps are not counted): a thing that stays is a detour.
  await dayPick(page, MONDAY).click();
  await settledCount(things(page, MONDAY));
  let laterMoved: boolean | null = null;
  const other = day(page, MONDAY).getByRole('button', {
    name: 'Aktionen für Steuerunterlagen sortieren',
    exact: true,
  });
  if (await other.count()) {
    await other.click();
    await page.getByRole('menuitem', { name: 'Später' }).click();
    await page.waitForTimeout(1500);
    await settledCount(things(page, MONDAY));
    laterMoved = (await day(page, MONDAY).getByText('Steuerunterlagen sortieren').count()) === 0;
    if (!laterMoved) m.detour();
  }
  facts(info, 'B', {
    menu,
    menuMoves,
    fieldY: fieldBox?.y,
    fieldOnScreen:
      !!fieldBox && fieldBox.y + fieldBox.height <= (isMobile ? PHONE : DESKTOP).height,
    previewText,
    stillOnMonday: stillMonday > 0,
    onWednesday: onWednesday > 0,
    pinned,
    laterMovedAThingOfTomorrow: laterMoved,
  });
  await record(info, m, name);
});

/**
 * The way to the source of a thing on Monday's sheet. `entry` undefined: the row's title, which opens the thing in
 * its module (one tap since R1); else the row's ⋯ and that entry (a second place the thing came from). The ⋯ is
 * read either way (not counted when the title is the way).
 */
async function openSource(
  page: Page,
  m: Meter,
  title: string,
  entry: string | undefined,
  h1: RegExp,
) {
  await m.go('/planner');
  await expect(things(page, MONDAY)).not.toHaveCount(0);
  await settledCount(things(page, MONDAY));
  const row = things(page, MONDAY).filter({ hasText: title });
  const actions = row.getByRole('button', { name: `Aktionen für ${title}`, exact: true });
  // „Danach“ is folded on the phone: a thing in it is one tap away (counted).
  if (!(await actions.isVisible()))
    await m.tap(day(page, MONDAY).getByRole('button', { name: /^Danach/ }));
  if (entry) await m.tap(actions);
  else await actions.click();
  await expect(page.getByRole('menuitem').first()).toBeVisible();
  const menu = await page.getByRole('menuitem').allInnerTexts();
  if (entry) {
    await m.nav(page.getByRole('menuitem', { name: entry, exact: true }), h1);
    return menu;
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  await m.nav(row.locator('button[data-row]'), h1);
  return menu;
}

test('C1 Quelle öffnen: ToDo', async ({ page, isMobile }, info) => {
  const name = 'C1 Quelle öffnen: ToDo';
  await prepare(page, 'week');
  const m = new Meter(page, isMobile);
  const menu = await openSource(page, m, 'Angebot Fahrradladen prüfen', undefined, /ToDos/);
  // The source opens as its edit form, over the list.
  const dialog = page.getByRole('dialog', { name: 'Aufgabe bearbeiten' });
  await expect(dialog).toBeVisible();
  m.dialog();
  const opened = await dialog.getByRole('textbox', { name: 'Titel' }).inputValue();
  if (opened !== 'Angebot Fahrradladen prüfen') m.detour();
  // The detail panel beside the list (wide page) may show another ToDo than the form: recorded.
  const aside = page.locator('main aside').first();
  const panel = (await aside.count()) ? await aside.innerText() : '';
  facts(info, 'C1', {
    menu,
    opened,
    url: new URL(page.url()).pathname + new URL(page.url()).search,
    detailPanel: panel.replace(/\s+/g, ' ').trim().slice(0, 80),
  });
  await record(info, m, name);
});

test('C2 Quelle öffnen: Rechnung', async ({ page, isMobile }, info) => {
  const name = 'C2 Quelle öffnen: Rechnung';
  await prepare(page, 'week');
  const m = new Meter(page, isMobile);
  const menu = await openSource(
    page,
    m,
    'Stadtwerke Musterstadt bezahlen',
    undefined,
    /Rechnungen/,
  );
  const dialog = page.getByRole('dialog', { name: 'Rechnung bearbeiten' });
  await expect(dialog).toBeVisible();
  m.dialog();
  const opened = await dialog.getByRole('textbox', { name: 'Empfänger' }).inputValue();
  if (opened !== 'Stadtwerke Musterstadt') m.detour();
  facts(info, 'C2', {
    menu,
    opened,
    url: new URL(page.url()).pathname + new URL(page.url()).search,
    // The form that opens is „bearbeiten“: paying is not in it.
    payInDialog: await dialog.getByRole('button', { name: /bezahlt/i }).count(),
  });
  await record(info, m, name);
});

test('C3 Quelle öffnen: Mail', async ({ page, isMobile }, info) => {
  const name = 'C3 Quelle öffnen: Mail';
  test.skip(isMobile, 'mail is a desktop-only module');
  // The e2e build lets the browser pose as the desktop app; the ToDo carries a mail link as „In den Plan“ writes it.
  await page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'desktop'));
  await showPreview(page);
  await prepare(page, 'week', { mail: true });
  const m = new Meter(page, false);
  const menu = await openSource(page, m, 'Angebot Fahrradladen prüfen', 'Zur Mail', /E-Mail/);
  // No mail account here (Gmail needs an OAuth login): the way is measured, the mail itself is not shown.
  const text = await page.locator('main').innerText();
  facts(info, 'C3', {
    menu,
    url: new URL(page.url()).pathname + new URL(page.url()).search,
    mailShown: !/Noch kein Mail-Konto verbunden/.test(text),
    mailPage: text.replace(/\s+/g, ' ').trim().slice(0, 160),
  });
  await record(info, m, name);
});

test('D Rest verteilen', async ({ page, isMobile }, info) => {
  const name = 'D Rest verteilen';
  await prepare(page, 'week');
  // Monday morning: today holds the nine things; since R1 the link stands at the sheet's foot at any hour
  // (recorded, not counted).
  await page.clock.setFixedTime(new Date(`${MONDAY}T10:00:00`));
  await ready(page, '/planner');
  await expect(things(page, MONDAY)).not.toHaveCount(0);
  await settledCount(things(page, MONDAY));
  const morning = await boardOf(page);
  const linkInTheMorning = await page.getByTestId('rest-link').count();
  // Monday 18:00: the same link at the foot of today's sheet.
  await page.clock.setFixedTime(new Date(`${MONDAY}T18:00:00`));
  const m = new Meter(page, isMobile);
  await m.go('/planner');
  await expect(things(page, MONDAY)).not.toHaveCount(0);
  await settledCount(things(page, MONDAY));
  const before = await boardOf(page);
  await m.tap(page.getByTestId('rest-link').getByRole('button', { name: 'Rest verteilen' }));
  const preview = page.getByTestId('plan-preview');
  await expect(preview).toBeVisible();
  m.dialog();
  const moves = (await preview.innerText()).split('\n').filter((l) => /→/.test(l));
  await m.tap(preview.getByRole('button', { name: 'Übernehmen' }));
  await expect(preview).toHaveCount(0);
  await expect(page.getByText('Auf die nächsten Tage verteilt.')).toBeVisible();
  const stuck = await settledCount(things(page, MONDAY));
  if (stuck > 0) m.detour();
  facts(info, 'D', {
    linkInTheMorning,
    morningHead: [morning.head, morning.headDetail],
    eveningHead: [before.head, before.headDetail],
    moves,
    stuckOnToday: stuck,
    after: await boardOf(page),
  });
  await record(info, m, name);
});

test('E Ding über das Planer-Feld', async ({ page, isMobile }, info) => {
  const name = 'E Ding über das Planer-Feld';
  await prepare(page, 'week');
  const m = new Meter(page, isMobile);
  await m.go('/planner');
  const field = page.getByRole('textbox', { name: 'Eintragen oder sagen' });
  await expect(field).toBeVisible();
  // First visit with things waiting: until the first run has placed them the page shows its empty state, and the
  // field stands lower; both are read as the page arrives and again once the plan is there (not counted).
  const emptyAtFirst = await page.getByTestId('planner-empty').count();
  const firstBox = await field.boundingBox();
  await expect(page.getByTestId('planner-empty')).toHaveCount(0);
  const box = await field.boundingBox();
  const focused = await field.evaluate((el) => el === document.activeElement);
  await m.type(field, 'Paket abholen');
  await m.enter(field);
  const toast = page.getByText(/^Eingetragen/).first();
  await expect(toast).toBeVisible();
  const said = await toast.innerText();
  const saved = (await rows<{ title: string }>(page, 'todos_task')).some(
    (t) => t.title === 'Paket abholen',
  );
  if (!saved) m.detour();
  facts(info, 'E', {
    emptyStateOnArrival: emptyAtFirst > 0,
    fieldYOnArrival: firstBox?.y,
    fieldY: box?.y,
    fieldWidth: box?.width,
    // `fill` focuses the field for the script; a person taps or tabs into it when it is not focused on arrival.
    focusedOnArrival: focused,
    toast: said,
    saved,
  });
  await record(info, m, name);
});

test('F Überfällige Rechnung begleichen', async ({ page, isMobile }, info) => {
  const name = 'F Überfällige Rechnung begleichen';
  await prepare(page, 'week');
  const m = new Meter(page, isMobile);
  await m.go('/planner');
  await expect(things(page, MONDAY)).not.toHaveCount(0);
  await settledCount(things(page, MONDAY));
  const row = things(page, MONDAY).filter({ hasText: 'Stadtwerke Musterstadt bezahlen' });
  await expect(row).toHaveCount(1);
  // The person looks for the tick the ToDo rows have: an invoice row has none (its lead slot shows the source's
  // icon; „Bezahlt …“ in that slot is package K1b).
  const tick = await row.getByRole('checkbox').count();
  if (tick === 0) m.detour();
  // The ⋯ cannot pay either (read, not counted).
  await row
    .getByRole('button', { name: 'Aktionen für Stadtwerke Musterstadt bezahlen', exact: true })
    .click();
  await expect(page.getByRole('menuitem').first()).toBeVisible();
  const menu = await page.getByRole('menuitem').allInnerTexts();
  const payInMenu = menu.some((item) => /bezahl|Erledigt/i.test(item));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  // The way on: the title leaves the planner and lands in the invoice's edit form, which cannot pay either.
  await m.nav(row.locator('button[data-row]'), /Rechnungen/);
  const dialog = page.getByRole('dialog', { name: 'Rechnung bearbeiten' });
  await expect(dialog).toBeVisible();
  m.dialog();
  await m.tap(dialog.getByRole('button', { name: 'Abbrechen' }));
  await expect(dialog).toHaveCount(0);
  await m.tap(
    page
      .locator('main li')
      .filter({ hasText: 'Stadtwerke Musterstadt' })
      .getByRole('button', { name: /Als bezahlt markieren/ }),
  );
  await expect(page.getByText('Als bezahlt markiert.')).toBeVisible();
  // Back to the plan.
  await m.back(/Planer/);
  await expect(things(page, MONDAY)).not.toHaveCount(0);
  await expect(day(page, MONDAY).getByText('Stadtwerke Musterstadt bezahlen')).toHaveCount(0);
  const paid = (await rows<{ payee: string; status: string }>(page, 'invoices_invoice')).find(
    (i) => i.payee === 'Stadtwerke Musterstadt',
  )?.status;
  expect(paid).toBe('paid');
  facts(info, 'F', { tickOnInvoiceRow: tick, menu, payInMenu, paid });
  await record(info, m, name);
});

test('M Designmaße: die Woche des Sonntags, wie sie öffnet, und heute', async ({
  page,
  isMobile,
}, info) => {
  test.setTimeout(120_000);
  // (1) Sunday as the page opens: on Monday, the first day that holds things – the nine things are on the screen.
  await prepare(page, 'week');
  await ready(page, '/planner');
  await expect(things(page, MONDAY)).not.toHaveCount(0);
  await expect(dayPick(page, MONDAY)).toHaveAttribute('aria-pressed', 'true');
  await settledCount(things(page, MONDAY));
  await page.waitForTimeout(1500);
  const landing = await design(page, info, 'M1 Sonntag, wie die Seite öffnet', 'dark');
  const landingLight = await design(page, info, 'M1 Sonntag, wie die Seite öffnet', 'light');
  const board = await boardOf(page);
  // The targets of R1 (HANDOFF §9), on the screen the page opens on, in both themes.
  for (const m of [landing, landingLight]) {
    expect(m.fonts.sizes.length, 'font sizes').toBeLessThanOrEqual(TARGET.fontSizes);
    if (isMobile) {
      expect(m.targets.small, 'targets under 44 px on the phone').toHaveLength(TARGET.smallTargets);
      // Seven tiles fit the phone and the sheet's first things are on the first screen.
      expect(m.rows.onScreen).toBeGreaterThanOrEqual(3);
    } else {
      expect(m.coverage.empty, 'empty share at 1920').toBeLessThanOrEqual(TARGET.emptyShare);
      expect(m.rows.onScreen, 'thing rows in full at 1920').toBeGreaterThanOrEqual(
        TARGET.rowsOnScreen,
      );
      expect(m.rows.begun, 'thing rows begun at 1920').toBeGreaterThanOrEqual(TARGET.rowsBegun);
      expect(m.field?.y, 'field y at 1920').toBeLessThanOrEqual(TARGET.fieldY);
      expect(m.field?.underWeek, 'field above the week').toBe(false);
    }
  }
  // The field has the focus on arrival on the desktop, never on the phone.
  const field = page.getByRole('textbox', { name: 'Eintragen oder sagen' });
  expect(await field.evaluate((el) => el === document.activeElement)).toBe(!isMobile);
  // (2) Today picked (Sunday, free): one calm line that says where the things are.
  await dayPick(page, SUNDAY).click();
  await expect(day(page, SUNDAY)).toContainText(
    'Heute ist frei. Der nächste Tag mit Dingen ist Montag.',
  );
  const today = await design(page, info, 'M2 Sonntag, heute gewählt', 'dark');
  await design(page, info, 'M2 Sonntag, heute gewählt', 'light');
  expect(landing.rows.all).toBeGreaterThan(0);
  expect(today.rows.all).toBe(0);
  facts(info, 'M', {
    head: [board.head, board.headDetail],
    week: board.week,
    thingsOnLanding: landing.rows.all,
    thingsOnToday: today.rows.all,
    rows: landing.rows,
    overdue: landing.overdue,
    smallTargets: landing.targets.small,
    fonts: landing.fonts,
    colours: landing.stimulus.colours,
    field: landing.field,
    headBox: landing.head,
    coverage: landing.coverage,
  });
});

test('N Designmaße: leere Seite', async ({ page }, info) => {
  await prepare(page, 'empty');
  await ready(page, '/planner');
  await expect(page.getByTestId('planner-empty')).toBeVisible();
  // Nothing planned: no figure in the head (head rule 4), the sheet says the next step.
  await expect(page.getByTestId('planner-head')).toHaveCount(0);
  await page.waitForTimeout(1000);
  const empty = await design(page, info, 'N Leer', 'dark');
  await design(page, info, 'N Leer', 'light');
  const board = await boardOf(page);
  facts(info, 'N', {
    head: [board.head, board.headDetail],
    emptyState: (await page.getByTestId('planner-empty').innerText()).replace(/\s+/g, ' ').trim(),
    field: empty.field,
    smallTargets: empty.targets.small,
  });
});

test('S Designmaße: Testdaten (Dev-Preview)', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'the seeded tour is measured on the PC');
  const seed = process.env.USECASE_SEED_URL;
  test.skip(!seed, 'needs the test data of a Dev-Preview: USECASE_SEED_URL=http://localhost:4174');
  test.setTimeout(180_000);
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00')); // the seed's clock
  await page.addInitScript(() => localStorage.setItem('tm-seed-autofilled', '1'));
  await page.goto(`${seed}/settings/entwickler`);
  await expect(page.locator('main h1')).toBeVisible();
  const section = page.locator('section[aria-labelledby="developer"]');
  await section.getByLabel('Umfang').selectOption('medium');
  await section.getByTestId('seed-load').click();
  await expect(section.getByTestId('seed-status')).toContainText('2026-09-29', { timeout: 90_000 });
  await page.goto(`${seed}/planner`);
  await expect(page.getByTestId('planner-head')).toBeVisible();
  await expect(page.locator('main [data-testid^="day-"] li').first()).toBeVisible();
  await settledCount(page.locator('main [data-testid^="day-"] li'));
  const seeded = await design(page, info, 'S Testdaten (medium), heute', 'dark');
  await design(page, info, 'S Testdaten (medium), heute', 'light');
  const board = await boardOf(page);
  facts(info, 'S', {
    head: [board.head, board.headDetail],
    week: board.week,
    shown: board.shown,
    overdue: seeded.overdue,
    withTick: seeded.rows.withTick,
    things: seeded.rows.all,
  });
});
