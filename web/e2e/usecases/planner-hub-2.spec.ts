import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { dismissNotices } from '../helpers';

/**
 * Use case „Planer als Ablage, kurze Wege“ (planner hub, round 2): one person dumps everything into the planner and
 * wants short ways. Monday 2026-11-30 is „today“; every row is invented and goes straight into IndexedDB. Three
 * flows, each on the best path the app offers today (a new control is used as soon as it is there):
 *  - A „12 gemischte Dinge abladen“: A1 all twelve into the planner's one field; A2 each one made the right kind
 *    (the global quick capture, then the modules' own „In den Plan“) and visible in the planner.
 *  - B „Finanzen checken, E-Mails durchgehen“: 3 open invoices (one late), 2 cancellation deadlines within 14 days,
 *    1 budget over its limit, 4 mails waiting for an answer – seen in the planner, then worked off.
 *  - C „Bündel und Besorgung“: C1 a bundle „Haushalt“ of five steps (and the duration the planner proposes);
 *    C2 an errand of two things and a shopping list of three.
 * Per path the script counts:
 *  - `taps`: handles (a tap, a typed line, a paste each count one; unfolding a group to reach a thing counts),
 *  - `perThing`: handles that act on one single thing beyond typing its own line (the „Einzelgriff je Ding“),
 *  - `moduleSwitches`: changes of the module route (leaving the planner for another module or the home screen, and
 *    coming back; an area page passed on the way is no stop of its own),
 *  - `rows`: thing rows the planner shows for the flow: today's sheet + „Noch ohne Tag“ + „Frist vorbei“ (counted
 *    from what the page names: the week tile's „· n Dinge“ and the groups' counts),
 *  - flow figures: `rightKind`, `linkedToPlan` (A), `forms`, `fields` (A2), `rowsBefore`, `rowsAfter`,
 *    `doneInPlanner` (B), `nextStepOnly`, `savedAsRoutine`, `durationProposed`, `learned` (C1), `oneRow`, `mapShown`
 *    (C2), `markVisible`, `markAgrees`, `tripsToPlanner` (D1: route changes to read the planned day starting in the
 *    thing's own module) and the D figures. A thing that cannot be done today is the word „nicht möglich“.
 *
 * `IST` is the measured state per path and project. `TARGET` is docs/design/planner-hub-2/ANALYSIS.md §3. Every build PR
 * re-measures `IST` (never loosened); a figure is asserted against the better of its `IST` and – once reached – its
 * `TARGET` (lower is better, except `HIGHER`); a word equals its `IST`. Three figures have their TARGET above their IST
 * on purpose – named prices, the bound is the TARGET (reaching it is no regression, more fails): C2 `createTaps` (0 → 8:
 * getting a round together is a choice, incl. one trip to Listen, and buys rows 2 → 1), D1 `taps` (11 → 16) and D1
 * `perThing` (5 → 10): from package 4a on a row's title expands it, so the jump into the module is two handles.
 * Re-measured by the packages: 10b: D1 · 4a: D1, C1 · 4b/4c/2: B · 5a: C1 · 5b: C2 · 1: D2 · 3: A1, C1 · 9: D3 · 11: D4.
 * `MEASURE=1` only measures. Facts (the click path, the module routes passed) land beside the table in
 * `test-results/usecase-planner-hub-2/`.
 *
 *   E2E_SEED=0 npx playwright test e2e/usecases/planner-hub-2.spec.ts --trace off
 */

const OUT = 'test-results/usecase-planner-hub-2';
const TODAY = '2026-11-30'; // Monday
const WEDNESDAY = '2026-12-02';
const NEXT_MONDAY = '2026-12-07';

type Figures = Record<string, number | string>;

/** Higher is better for these; every other count is better lower. */
const HIGHER = ['rightKind', 'linkedToPlan', 'doneInPlanner', 'markVisible', 'markAgrees'];

/**
 * The measured state: 2026-11-23 on `develop` (design/planner-hub-2), keyed `<path> · <project>`. The phone differs
 * where its navigation does (area in the bottom bar, the module used last there) and where a module is desktop-only
 * (mail).
 */
// prettier-ignore
const IST: Record<string, Figures> = {
  'A1 Alles ins Planer-Feld · desktop-chrome': { rows: 11, moduleSwitches: 0, taps: 12, perThing: 0, rightKind: 4, linkedToPlan: 4 },
  'A1 Alles ins Planer-Feld · pixel-7': { rows: 11, moduleSwitches: 0, taps: 12, perThing: 0, rightKind: 4, linkedToPlan: 4 },
  'A2 Jedes Ding als richtige Art · desktop-chrome': { rows: 8, moduleSwitches: 3, taps: 33, perThing: 13, forms: 2, fields: 5, rightKind: 12, linkedToPlan: 11 },
  'A2 Jedes Ding als richtige Art · pixel-7': { rows: 8, moduleSwitches: 5, taps: 34, perThing: 14, forms: 2, fields: 5, rightKind: 12, linkedToPlan: 11 },
  'B Finanzen und Mails abarbeiten · desktop-chrome': { rowsBefore: 5, taps: 27, perThing: 17, moduleSwitches: 5, doneInPlanner: 1, rowsAfter: 1, mails: 4 },
  'B Finanzen und Mails abarbeiten · pixel-7': { rowsBefore: 5, taps: 14, perThing: 9, moduleSwitches: 5, doneInPlanner: 1, rowsAfter: 1, mails: 'nicht möglich' },
  'C1 Bündel Haushalt · desktop-chrome': { rows: 1, createTaps: 12, workTaps: 7, taps: 19, perThing: 6, moduleSwitches: 4, nextStepOnly: 'nein', savedAsRoutine: 'ja', durationProposed: 30, learned: 'nein' },
  'C1 Bündel Haushalt · pixel-7': { rows: 1, createTaps: 12, workTaps: 7, taps: 19, perThing: 6, moduleSwitches: 5, nextStepOnly: 'nein', savedAsRoutine: 'ja', durationProposed: 30, learned: 'nein' },
  'C2 Besorgung · desktop-chrome': { rows: 2, createTaps: 0, workTaps: 9, perThing: 5, moduleSwitches: 2, oneRow: 'nein', mapShown: 'nicht möglich' },
  'C2 Besorgung · pixel-7': { rows: 2, createTaps: 0, workTaps: 8, perThing: 5, moduleSwitches: 2, oneRow: 'nein', mapShown: 'nicht möglich' },
  'D1 Steht es im Plan, und wann · desktop-chrome': { taps: 11, perThing: 5, moduleSwitches: 10, markVisible: 1, markAgrees: 2, tripsToPlanner: 8 },
  'D1 Steht es im Plan, und wann · pixel-7': { taps: 11, perThing: 5, moduleSwitches: 10, markVisible: 1, markAgrees: 2, tripsToPlanner: 8 },
  'D2 Geteilter Link in den Planer · desktop-chrome': { taps: 5, moduleSwitches: 2, forms: 1, inPlanner: 'ja', wayBack: 'nein' },
  'D2 Geteilter Link in den Planer · pixel-7': { taps: 5, moduleSwitches: 3, forms: 1, inPlanner: 'ja', wayBack: 'nein' },
  'D3 Vor einem Termin · desktop-chrome': { taps: 14, perThing: 0, moduleSwitches: 4, linked: 'ja', onWednesday: 'ja' },
  'D3 Vor einem Termin · pixel-7': { taps: 14, perThing: 0, moduleSwitches: 4, linked: 'ja', onWednesday: 'ja' },
  'D4 Ein Thema · desktop-chrome': { rows: 20, taps: 27, perThing: 20, moduleSwitches: 2, planFilter: 'nein' },
  'D4 Ein Thema · pixel-7': { rows: 20, taps: 22, perThing: 15, moduleSwitches: 2, planFilter: 'nein' },
  'D5 Warte auf Antwort · desktop-chrome': { taps: 7, perThing: 3, moduleSwitches: 0, rowsOffSheet: 3, comesBackByItself: 'ja' },
  'D5 Warte auf Antwort · pixel-7': { taps: 7, perThing: 3, moduleSwitches: 0, rowsOffSheet: 3, comesBackByItself: 'ja' },
};

// TARGET: docs/design/planner-hub-2/ANALYSIS.md §3 (set by the design lead). Struck ideas (D5, C1 learned) keep their IST.
// prettier-ignore
const TARGET: Record<string, Figures> = {
  'A1 Alles ins Planer-Feld · desktop-chrome': { rows: 7, moduleSwitches: 0, taps: 12, perThing: 0, rightKind: 12, linkedToPlan: 10 },
  'A1 Alles ins Planer-Feld · pixel-7': { rows: 7, moduleSwitches: 0, taps: 12, perThing: 0, rightKind: 12, linkedToPlan: 10 },
  'A2 Jedes Ding als richtige Art · desktop-chrome': { rows: 8, moduleSwitches: 3, taps: 33, perThing: 13, forms: 2, fields: 5, rightKind: 12, linkedToPlan: 11 },
  'A2 Jedes Ding als richtige Art · pixel-7': { rows: 8, moduleSwitches: 5, taps: 34, perThing: 14, forms: 2, fields: 5, rightKind: 12, linkedToPlan: 11 },
  'B Finanzen und Mails abarbeiten · desktop-chrome': { rowsBefore: 2, taps: 13, perThing: 11, moduleSwitches: 0, doneInPlanner: 10, rowsAfter: 0, mails: 4 },
  'B Finanzen und Mails abarbeiten · pixel-7': { rowsBefore: 1, taps: 8, perThing: 7, moduleSwitches: 0, doneInPlanner: 6, rowsAfter: 0, mails: 'nicht möglich' },
  'C1 Bündel Haushalt · desktop-chrome': { rows: 1, createTaps: 1, workTaps: 7, taps: 8, perThing: 5, moduleSwitches: 0, nextStepOnly: 'ja', savedAsRoutine: 'ja', durationProposed: 30, learned: 'nein' },
  'C1 Bündel Haushalt · pixel-7': { rows: 1, createTaps: 1, workTaps: 7, taps: 8, perThing: 5, moduleSwitches: 0, nextStepOnly: 'ja', savedAsRoutine: 'ja', durationProposed: 30, learned: 'nein' },
  'C2 Besorgung · desktop-chrome': { rows: 1, createTaps: 8, workTaps: 6, perThing: 5, moduleSwitches: 2, oneRow: 'ja', mapShown: 'nicht möglich' },
  'C2 Besorgung · pixel-7': { rows: 1, createTaps: 8, workTaps: 6, perThing: 5, moduleSwitches: 2, oneRow: 'ja', mapShown: 'nicht möglich' },
  'D1 Steht es im Plan, und wann · desktop-chrome': { taps: 16, perThing: 10, moduleSwitches: 10, markVisible: 5, markAgrees: 5, tripsToPlanner: 0 },
  'D1 Steht es im Plan, und wann · pixel-7': { taps: 16, perThing: 10, moduleSwitches: 10, markVisible: 5, markAgrees: 5, tripsToPlanner: 0 },
  'D2 Geteilter Link in den Planer · desktop-chrome': { taps: 2, moduleSwitches: 1, forms: 1, inPlanner: 'ja', wayBack: 'ja' },
  'D2 Geteilter Link in den Planer · pixel-7': { taps: 2, moduleSwitches: 1, forms: 1, inPlanner: 'ja', wayBack: 'ja' },
  'D3 Vor einem Termin · desktop-chrome': { taps: 3, perThing: 0, moduleSwitches: 0, linked: 'ja', onWednesday: 'ja' },
  'D3 Vor einem Termin · pixel-7': { taps: 3, perThing: 0, moduleSwitches: 0, linked: 'ja', onWednesday: 'ja' },
  'D4 Ein Thema · desktop-chrome': { rows: 7, taps: 11, perThing: 5, moduleSwitches: 0, planFilter: 'ja' },
  'D4 Ein Thema · pixel-7': { rows: 7, taps: 11, perThing: 5, moduleSwitches: 0, planFilter: 'ja' },
  'D5 Warte auf Antwort · desktop-chrome': { taps: 7, perThing: 3, moduleSwitches: 0, rowsOffSheet: 3, comesBackByItself: 'ja' },
  'D5 Warte auf Antwort · pixel-7': { taps: 7, perThing: 3, moduleSwitches: 0, rowsOffSheet: 3, comesBackByItself: 'ja' },
};

const base = { createdAt: 1, updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };

/** The modules the person has on (the library's switches write the same rows). */
const MODULES = [
  'todos',
  'planner',
  'invoices',
  'subscriptions',
  'finance',
  'budgets',
  'lists',
  'notes',
  'calendar',
  'bookmarks',
  'mail',
  'routines',
  'maps',
];

/** Where a module lives in the navigation: its route and its area (sidebar group / phone area page). */
const PLACES = {
  planner: { path: '/planner', area: 'Planen', areaPath: '/planen' },
  calendar: { path: '/calendar', area: 'Planen', areaPath: '/planen' },
  todos: { path: '/todos', area: 'Planen', areaPath: '/planen' },
  invoices: { path: '/invoices', area: 'Geld', areaPath: '/geld' },
  subscriptions: { path: '/subscriptions', area: 'Geld', areaPath: '/geld' },
  budgets: { path: '/budgets', area: 'Geld', areaPath: '/geld' },
  lists: { path: '/lists', area: 'Haushalt', areaPath: '/haushalt' },
  routines: { path: '/routines', area: 'Haushalt', areaPath: '/haushalt' },
  notes: { path: '/notes', area: 'Wissen', areaPath: '/wissen' },
  mail: { path: '/mail', area: 'Wissen', areaPath: '/wissen' },
  bookmarks: { path: '/bookmarks', area: 'Wissen', areaPath: '/wissen' },
} as const;
type Place = keyof typeof PLACES;

/** Area pages (phone) are passed on the way to a module: no stop of their own. */
const AREA_PAGES = ['planen', 'geld', 'haushalt', 'wissen'];

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
            return resolve([]);
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

/**
 * An install with the person's modules on and today fixed; the desktop project poses as the desktop app (mail is a
 * desktop module), the phone stays a phone. `extra`: the flow's own rows.
 */
async function prepare(
  page: Page,
  isMobile: boolean,
  extra: Record<string, Record<string, unknown>[]> = {},
) {
  if (!isMobile)
    await page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'desktop'));
  await page.clock.setFixedTime(new Date(`${TODAY}T09:00:00`));
  await dismissNotices(page);
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await put(page, {
    _modules: MODULES.map((id) => ({ id, enabled: true, dataPolicy: null })),
    todos_list: [{ id: 'inbox', name: 'Eingang', order: 0 }],
    ...extra,
  });
}

/** The planner, the place every flow starts and ends. */
async function planner(page: Page) {
  await page.goto('/planner');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.getByTestId(`week-${TODAY}`)).toBeVisible();
}

class Hand {
  taps = 0;
  perThing = 0;
  forms = 0;
  fields = 0;
  /** The module routes in the order the person passed them (`home` = the home screen). */
  places: string[] = [];
  /** Per thing: where its handles were made. */
  where = new Map<string, Set<string>>();
  /** The click path as words, for the facts. */
  path: string[] = [];
  constructor(
    private page: Page,
    private mobile: boolean,
  ) {
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return;
      const place = placeOf(frame.url());
      if (place && this.places.at(-1) !== place) this.places.push(place);
    });
  }
  start() {
    this.places = [placeOf(this.page.url()) ?? 'home'];
  }
  get moduleSwitches() {
    return Math.max(0, this.places.length - 1);
  }
  private mark(thing: string | undefined, what: string) {
    const here = placeOf(this.page.url()) ?? 'area';
    this.path.push(`${here}: ${what}`);
    if (!thing) return;
    this.perThing += 1;
    const set = this.where.get(thing) ?? new Set<string>();
    set.add(here);
    this.where.set(thing, set);
  }
  async tap(target: Locator, what: string, thing?: string) {
    this.taps += 1;
    this.mark(thing, what);
    if (this.mobile) await target.tap();
    else await target.click();
  }
  /** A typed line or a paste: one handle (`lines`: several typed lines in one field). */
  async fill(
    target: Locator,
    text: string,
    what: string,
    opts: { thing?: string; lines?: number } = {},
  ) {
    this.taps += opts.lines ?? 1;
    this.mark(opts.thing, what);
    await target.fill(text);
  }
  /** A choice in a select: one handle. */
  async choose(target: Locator, label: string, what: string, thing?: string) {
    this.taps += 1;
    this.mark(thing, what);
    await target.selectOption({ label });
  }
  /** A handle that acts on several things at once (no „Einzelgriff“): where it was made, for each of them. */
  touch(things: readonly string[]) {
    const here = placeOf(this.page.url()) ?? 'area';
    for (const thing of things) {
      const set = this.where.get(thing) ?? new Set<string>();
      set.add(here);
      this.where.set(thing, set);
    }
  }
  /** Things whose every handle was made on the planner's route. */
  onlyInPlanner(things: readonly string[]) {
    return things.filter((x) => {
      const at = this.where.get(x);
      return !!at && [...at].every((p) => p === 'planner');
    }).length;
  }
}

/** The module route of a URL (`home` for the home screen); undefined for an area page passed on the way. */
function placeOf(url: string): string | undefined {
  const seg = new URL(url).pathname.split('/')[1] ?? '';
  if (AREA_PAGES.includes(seg)) return undefined;
  return seg === '' ? 'home' : seg;
}

/**
 * To a module through the navigation, as the person does: the sidebar link (unfolding its area first when it is
 * folded) on the desktop; on the phone the area in the bottom bar (or under „Mehr“) and the module's tile there.
 */
async function go(hand: Hand, page: Page, isMobile: boolean, to: Place, thing?: string) {
  const place = PLACES[to];
  if (!isMobile) {
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    const link = nav.locator(`a[href="${place.path}"]:visible`).first();
    if (!(await link.count()))
      await hand.tap(
        nav.getByRole('button', { name: `${place.area} auf- oder zuklappen` }),
        `Bereich ${place.area} aufklappen`,
        thing,
      );
    await hand.tap(link, `Navigation ${to}`, thing);
  } else if (await appears(page.locator(`a[href="${place.path}"]:visible`).first(), 1000)) {
    // A module of the same area: its tab in the page's head.
    await hand.tap(page.locator(`a[href="${place.path}"]:visible`).first(), `Reiter ${to}`, thing);
  } else {
    const before = page.url();
    const bar = page.getByRole('navigation', { name: 'Hauptnavigation' }).last();
    const areaLink = bar.locator(`a[href="${place.areaPath}"]`);
    if (await areaLink.count()) await hand.tap(areaLink, `Leiste ${place.area}`, thing);
    else {
      await hand.tap(bar.getByRole('button', { name: /^Mehr/ }), 'Mehr', thing);
      const sheet = page.getByRole('dialog');
      await hand.tap(
        sheet
          .getByRole('link', { name: place.area, exact: true })
          .or(sheet.getByRole('button', { name: place.area, exact: true }))
          .first(),
        `Mehr · ${place.area}`,
        thing,
      );
    }
    // The area opens the module used last there (`AreaRedirect`), else its page of tiles: wait until it stays.
    await expect.poll(() => page.url()).not.toBe(before);
    let last = '';
    await expect
      .poll(
        () => {
          const same = page.url() === last;
          last = page.url();
          return same;
        },
        { intervals: [400] },
      )
      .toBe(true);
    if (!new URL(page.url()).pathname.startsWith(place.path))
      await hand.tap(page.locator(`a[href="${place.path}"]:visible`).first(), `Zu ${to}`, thing);
  }
  await expect(page).toHaveURL(new RegExp(`${place.path}(\\?|$)`));
  await expect(page.locator('main h1')).toBeVisible();
}

/** Whether a control shows up within a short while (a page that is still rendering decides nothing). */
const appears = (target: Locator, timeout = 2500) =>
  target
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);

/** A count that has settled: two reads 400 ms apart agree. */
async function settled(read: () => Promise<number>): Promise<number> {
  let last = -1;
  await expect
    .poll(
      async () => {
        const now = await read();
        const same = now === last;
        last = now;
        return same;
      },
      { intervals: [400], timeout: 20_000 },
    )
    .toBe(true);
  return last;
}

/** Things on a day's sheet, as its week tile names them („… · 11 Dinge“). */
async function onDay(page: Page, date: string): Promise<number> {
  const tile = page.getByTestId(`week-${date}`);
  const label = (await tile.getAttribute('aria-label')) ?? (await tile.innerText());
  const m = /· (\d+) Dinge?/.exec(label.replace(/\s+/g, ' '));
  return m ? Number(m[1]) : 0;
}

/** „Noch ohne Tag“: the count its head shows (0 without the group). */
async function noDay(page: Page): Promise<number> {
  const head = page.getByRole('button', { name: /^Noch ohne Tag (aus|ein)klappen$/ });
  if (!(await head.count())) return 0;
  // The count stands beside the group's title (its head row), not in the button.
  const text = await head.evaluate((el) => {
    let at: HTMLElement | null = el as HTMLElement;
    for (let i = 0; i < 4 && at; i++, at = at.parentElement) {
      const m = /Noch ohne Tag\s+(\d+)/.exec(at.innerText);
      if (m) return m[1]!;
    }
    return '';
  });
  const m = /(\d+)/.exec(text);
  return m ? Number(m[1]) : 0;
}

/** „Frist vorbei“: its rows (desktop) or the count of its folded row (phone). */
async function late(page: Page): Promise<number> {
  const fold = page.getByTestId('planner-late-row');
  if (await fold.count()) {
    const m = /· (\d+)/.exec(await fold.innerText());
    return m ? Number(m[1]) : 0;
  }
  return page.getByTestId('planner-late').locator('li').count();
}

/** The planner's thing rows for a flow: today's sheet, „Noch ohne Tag“ and „Frist vorbei“. */
async function plannerRows(page: Page) {
  await expect(page.getByTestId(`week-${TODAY}`)).toBeVisible();
  const today = await settled(() => onDay(page, TODAY));
  const waiting = await settled(() => noDay(page));
  const overdue = await settled(() => late(page));
  return { today, noDay: waiting, late: overdue, all: today + waiting + overdue };
}

/** Every row of the planner in reach of the text (not counted: the script reads what the person sees). */
async function unfold(page: Page) {
  const head = page.getByRole('button', { name: /^Noch ohne Tag ausklappen$/ });
  if (await head.count()) await head.click();
  const then = page.getByTestId(`day-${TODAY}`).getByRole('button', { name: /^Danach/ });
  if ((await then.count()) && (await then.getAttribute('aria-expanded')) === 'false') {
    await then.click();
    await expect(then).toHaveAttribute('aria-expanded', 'true');
  }
  const more = page.getByTestId('planner-more');
  if (await more.count()) {
    await more.first().click();
    await expect(more).toHaveCount(0);
  }
  const fold = page.getByTestId('planner-late-row');
  if ((await fold.count()) && (await fold.getAttribute('aria-expanded')) !== 'true')
    await fold.click();
}

/** The planner's text with every group open. */
async function plannerText(page: Page): Promise<string> {
  await unfold(page);
  await page.waitForTimeout(300);
  return (await page.locator('main').innerText()).replace(/[ \t]+/g, ' ');
}

function record(info: TestInfo, name: string, figures: Figures, facts: unknown) {
  mkdirSync(OUT, { recursive: true });
  const project = info.project.name;
  const key = `${name.split(' ')[0]}-${project}`;
  writeFileSync(`${OUT}/${key}.json`, JSON.stringify({ name, project, figures }));
  writeFileSync(`${OUT}/${key}-facts.json`, JSON.stringify(facts, null, 1));
  const lines = readdirSync(OUT)
    .filter((f) => /^[ABC]\d?-.+\.json$/.test(f) && !f.endsWith('-facts.json'))
    .sort()
    .flatMap((f) => {
      const row = JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')) as {
        name: string;
        project: string;
        figures: Figures;
      };
      const id = `${row.name} · ${row.project}`;
      return Object.entries(row.figures).map(
        ([k, v]) =>
          `| ${row.name} | ${row.project} | ${k} | ${v} | ${IST[id]?.[k] ?? '–'} | ${TARGET[id]?.[k] ?? '–'} |`,
      );
    });
  writeFileSync(
    `${OUT}.md`,
    [
      '| Pfad | Projekt | Messgröße | gemessen | IST | Ziel |',
      '| --- | --- | --- | --- | --- | --- |',
      ...lines,
      '',
    ].join('\n'),
  );
  info.annotations.push({ type: 'usecase', description: `${name}: ${JSON.stringify(figures)}` });
  console.log(name, project, JSON.stringify(figures));
  if (process.env.MEASURE !== '1') reached(`${name} · ${project}`, figures);
}

/**
 * A count may not get worse than the better of its `IST` and its `TARGET` – the target only binds once it is reached
 * (a build PR moves `IST` there); lower is better except for `HIGHER`. A word equals its `IST`.
 */
function reached(id: string, figures: Figures) {
  const ist = IST[id];
  expect(ist, `no IST for „${id}“`).toBeTruthy();
  const target = TARGET[id] ?? {};
  for (const k of Object.keys(ist!)) {
    const was = ist![k]!;
    const want = target[k];
    const got = figures[k];
    if (typeof was === 'string') {
      expect(got, `${id}: ${k}`).toBe(was);
      continue;
    }
    if (HIGHER.includes(k)) {
      const bound = typeof want === 'number' && want <= was ? want : was;
      expect(got, `${id}: ${k} ≥ ${bound}`).toBeGreaterThanOrEqual(bound);
    } else {
      const bound = typeof want === 'number' && was <= want ? want : was;
      expect(got, `${id}: ${k} ≤ ${bound}`).toBeLessThanOrEqual(bound);
    }
  }
}

test.beforeEach(() => {
  test.setTimeout(240_000);
});

// ---------------------------------------------------------------------------------------------------------------
// A  12 gemischte Dinge abladen

const DUMP = [
  'Rechnung Stadtwerke 80 € bis Fr',
  'Rechnung Zahnarzt 120 € bis 10.12.',
  'Milch',
  'Spülmittel',
  'Batterien AA',
  'Vermieter antworten wegen Nebenkosten',
  'Mi 15:00 Friseur',
  'Idee: Regal im Flur',
  'https://example.org/fahrradtraeger',
  'Wäsche',
  'Altglas wegbringen',
  'Paket abholen',
] as const;
const TASKS = [
  'Vermieter antworten wegen Nebenkosten',
  'Wäsche',
  'Altglas wegbringen',
  'Paket abholen',
];
const SHOPPING = ['Milch', 'Spülmittel', 'Batterien AA'];

interface Task {
  id: string;
  title: string;
  done: boolean;
  someday?: boolean;
  estimateMin?: number;
  links?: { kind: string; id: string }[];
}

/**
 * Which of the twelve exist as the right kind in the right module, and which of those the planner shows: an invoice
 * in Rechnungen with amount and due day (its row „… bezahlen“), a list entry in a list (the list's one row
 * „Einkaufen · n Dinge“), the appointment in the calendar (the „Termine“ card), the note in Notizen (a ToDo that links
 * it), the link in the Merkliste (its own row), the four plain things as ToDos (their rows).
 */
async function kinds(page: Page) {
  const [tasks, invoices, items, events, notes, marks] = await Promise.all([
    rows<Task>(page, 'todos_task'),
    rows<{ payee: string; amountMinor: number; dueDate: string }>(page, 'invoices_invoice'),
    rows<{ name: string; listId: string }>(page, 'lists_item'),
    rows<{ title: string; startDate: string; startTime?: string }>(page, 'calendar_event'),
    rows<{ id: string; title: string }>(page, 'notes_note'),
    rows<{ id: string; title: string; url?: string; kind: string; inPlan?: boolean }>(
      page,
      'bookmarks_item',
    ),
  ]);
  await planner(page);
  const text = await plannerText(page);
  const shows = (line: string) => text.split('\n').some((l) => l.trim() === line);
  const open = tasks.filter((x) => !x.done && !x.someday);
  const right: Record<string, boolean> = {};
  const linked: Record<string, boolean> = {};
  for (const [payee, cents, due] of [
    ['Stadtwerke', 8000, '2026-12-04'],
    ['Zahnarzt', 12000, '2026-12-10'],
  ] as const) {
    const key = `Rechnung ${payee}`;
    right[key] = invoices.some(
      (i) => i.payee === payee && i.amountMinor === cents && i.dueDate === due,
    );
    linked[key] = right[key] && shows(`${payee} bezahlen`);
  }
  const listRow = /^Einkaufen · \d+ Dinge?$/m.test(text);
  for (const item of SHOPPING) {
    right[item] = items.some((i) => i.name === item);
    linked[item] = right[item] && listRow;
  }
  right.Friseur = events.some(
    (e) => e.title === 'Friseur' && e.startDate === WEDNESDAY && e.startTime === '15:00',
  );
  linked.Friseur = right.Friseur && shows('Friseur');
  const note = notes.find((n) => /Regal im Flur/.test(n.title));
  right.Notiz = !!note;
  linked.Notiz =
    !!note && open.some((x) => x.links?.some((l) => l.kind === 'note' && l.id === note.id));
  const mark = marks.find((m) => m.url === 'https://example.org/fahrradtraeger');
  right.Link = !!mark;
  linked.Link = !!mark && !!mark.inPlan && mark.kind !== 'link';
  for (const title of TASKS) {
    right[title] = open.some((x) => x.title === title);
    linked[title] = right[title] && shows(title);
  }
  return {
    rightKind: Object.values(right).filter(Boolean).length,
    linkedToPlan: Object.values(linked).filter(Boolean).length,
    right,
    linked,
    stored: {
      todos: tasks.map((x) => x.title),
      invoices: invoices.length,
      listItems: items.length,
      events: events.length,
      notes: notes.length,
      bookmarks: marks.map((m) => `${m.kind}${m.inPlan ? ' · im Plan' : ''}`),
    },
  };
}

test('A1 Alles ins Planer-Feld', async ({ page, isMobile }, info) => {
  const name = 'A1 Alles ins Planer-Feld';
  await prepare(page, isMobile);
  await planner(page);
  const hand = new Hand(page, isMobile);
  hand.start();
  const field = page.getByRole('textbox', { name: 'Eintragen oder sagen' });
  for (const [i, line] of DUMP.entries()) {
    await hand.fill(field, line, `Feld: ${line}`);
    await field.press('Enter');
    await expect(field).toHaveValue('');
    await expect.poll(async () => (await rows<Task>(page, 'todos_task')).length).toBe(i + 1);
  }
  const after = await plannerRows(page);
  const switches = hand.moduleSwitches;
  const k = await kinds(page);
  record(
    info,
    name,
    {
      rows: after.all,
      moduleSwitches: switches,
      taps: hand.taps,
      perThing: hand.perThing,
      rightKind: k.rightKind,
      linkedToPlan: k.linkedToPlan,
    },
    { rows: after, places: hand.places, path: hand.path, ...k },
  );
});

test('A2 Jedes Ding als richtige Art', async ({ page, isMobile }, info) => {
  const name = 'A2 Jedes Ding als richtige Art';
  await prepare(page, isMobile);
  await planner(page);
  const hand = new Hand(page, isMobile);
  hand.start();
  // The global quick capture: the top bar's „Neu“ on the desktop (over the planner); on the phone the planner's plus
  // is the planner's own field, so the capture is the plus of the home screen.
  if (isMobile) {
    await hand.tap(
      page.getByRole('navigation', { name: 'Hauptnavigation' }).last().locator('a[href="/"]'),
      'Leiste Übersicht',
    );
    await expect(page).toHaveURL(/\/$/);
  }
  await hand.tap(
    page.getByRole('button', { name: /^(Neu: etwas eintragen|Neu eintragen)$/ }).first(),
    'Neu eintragen',
  );
  hand.forms += 1;
  const input = page.getByRole('textbox', { name: 'Was möchtest du festhalten?' });
  hand.fields += 1;
  await hand.fill(input, DUMP.join('\n'), '12 Zeilen getippt', { lines: DUMP.length });
  await expect(page.getByTestId('capture-row')).toHaveCount(DUMP.length);
  const guessed = await page
    .getByTestId('capture-row-target')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-type') ?? ''));
  // Each line whose guessed target is not its kind: the target, then the right one (two handles, one field).
  const want: Record<string, string> = {
    Milch: 'Einkauf',
    Spülmittel: 'Einkauf',
    'Batterien AA': 'Einkauf',
    'Idee: Regal im Flur': 'Notiz',
  };
  const typeOf: Record<string, string> = { Einkauf: 'list', Notiz: 'note' };
  for (const [i, line] of DUMP.entries()) {
    const label = want[line];
    if (!label || guessed[i] === typeOf[label]) continue;
    await hand.tap(page.getByTestId('capture-row-target').nth(i), `Ziel von „${line}“`, line);
    hand.fields += 1;
    await hand.choose(page.getByTestId('capture-row-type'), label, `Ziel ${label}`, line);
    await expect(page.getByTestId('capture-row-target').nth(i)).toHaveAttribute(
      'data-type',
      typeOf[label]!,
    );
  }
  await hand.tap(page.getByRole('button', { name: /^Alle speichern/ }), 'Alle speichern');
  await expect(page.getByText(/Dinge gespeichert/)).toBeVisible();
  // The shopping list into the plan: Listen · the list's ⋯ · „In den Plan“ (one row for the list).
  await go(hand, page, isMobile, 'lists');
  await expect(page.getByText('Milch', { exact: true }).first()).toBeVisible();
  await hand.tap(
    page.locator('main').getByRole('button', { name: 'Weitere Aktionen' }).first(),
    'Liste ⋯',
  );
  await hand.tap(page.getByRole('menuitem', { name: 'In den Plan', exact: true }), 'In den Plan');
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  // The note into the plan: Notizen · the page's ⋯ · „In den Plan“ · its dialog (a ToDo that links the note).
  const note = 'Idee: Regal im Flur';
  await go(hand, page, isMobile, 'notes', note);
  const pageRow = page
    .locator('main')
    .getByRole('button', { name: note, exact: true })
    .or(page.locator('main').getByRole('link', { name: note, exact: true }))
    .first();
  await expect(pageRow).toBeVisible();
  const pageMenu = page.locator('main').getByRole('button', { name: 'Seite: weitere Aktionen' });
  if (!(await appears(pageMenu.first()))) await hand.tap(pageRow, 'Seite öffnen', note);
  await hand.tap(pageMenu.first(), 'Seite ⋯', note);
  await hand.tap(page.getByRole('menuitem', { name: /^In den Plan/ }), 'In den Plan', note);
  const planDialog = page.getByRole('dialog', { name: 'In den Plan' });
  await expect(planDialog).toBeVisible();
  hand.forms += 1;
  await hand.tap(
    planDialog.getByRole('button', { name: /^In den Plan/ }).last(),
    'In den Plan (Dialog)',
    note,
  );
  await expect(planDialog).toHaveCount(0);
  // The link: the Merkliste offers „In den Plan“ only for what is no plain link (`bookmarks/plannable.ts`).
  await go(hand, page, isMobile, 'planner');
  const after = await plannerRows(page);
  const switches = hand.moduleSwitches;
  const k = await kinds(page);
  record(
    info,
    name,
    {
      rows: after.all,
      moduleSwitches: switches,
      taps: hand.taps,
      perThing: hand.perThing,
      forms: hand.forms,
      fields: hand.fields,
      rightKind: k.rightKind,
      linkedToPlan: k.linkedToPlan,
    },
    { rows: after, guessed, places: hand.places, path: hand.path, ...k },
  );
});

// ---------------------------------------------------------------------------------------------------------------
// B  Finanzen checken, E-Mails durchgehen

const INVOICES = [
  // Late: due last Wednesday.
  { id: 'i1', payee: 'Stadtwerke Beispiel', amountMinor: 8000, dueDate: '2026-11-25' },
  { id: 'i2', payee: 'Zahnarzt Dr. Muster', amountMinor: 12000, dueDate: '2026-12-03' },
  { id: 'i3', payee: 'Musikschule Beispiel', amountMinor: 4500, dueDate: '2026-12-09' },
];
/** Monthly, seven days' notice: the last days to cancel are Thu 3.12. and Tue 8.12. (within 14 days). */
const SUBSCRIPTIONS = [
  { id: 's1', name: 'Streamingdienst Beispiel', amountMinor: 1299, startDate: '2026-01-10' },
  { id: 's2', name: 'Fitnessstudio Muster', amountMinor: 2990, startDate: '2026-01-15' },
];
/** Four mails of people waiting for an answer (the demo mailbox: invented rows, no account). */
const MAILS = [
  { from: 'Anna Beispiel', subject: 'Treffen am Samstag?' },
  { from: 'Hausverwaltung Muster', subject: 'Nebenkosten 2025' },
  { from: 'Bernd Muster', subject: 'Fotos vom Ausflug' },
  { from: 'Verein Beispiel', subject: 'Helfer gesucht' },
];

const financeScene = {
  invoices_invoice: INVOICES.map((i) => ({ ...i, status: 'open' })),
  subscriptions_subscription: SUBSCRIPTIONS.map((s) => ({
    ...s,
    recurrence: { freq: 'monthly', interval: 1 },
    cancelNoticeDays: 7,
    active: true,
  })),
  finance_account: [{ id: 'acc', name: 'Girokonto', openingBalanceMinor: 100000, order: 0 }],
  finance_category: [{ id: 'cat-food', name: 'Lebensmittel', kind: 'expense' }],
  // 260 € spent on food this month, the limit is 200 €.
  finance_transaction: [
    {
      id: 'tx1',
      accountId: 'acc',
      categoryId: 'cat-food',
      kind: 'expense',
      amountMinor: 26000,
      date: '2026-11-20',
      payee: 'Supermarkt',
    },
  ],
  budgets_budget: [{ id: 'b1', categoryId: 'cat-food', monthlyLimitMinor: 20000 }],
  mail_thread: MAILS.map((m, i) => ({
    id: `demo|t${i}`,
    accountKey: 'demo',
    threadId: `t${i}`,
    sortKey: 1_796_000_000_000 + i,
    unread: true,
    inbox: true,
    demo: {
      from: { name: m.from, email: `person${i}@example.org` },
      subject: m.subject,
      snippet: 'Kannst du mir bitte kurz antworten?',
      messageCount: 1,
      hasAttachment: false,
      labelIds: ['INBOX'],
      personal: true,
    },
  })),
};

test('B Finanzen und Mails abarbeiten', async ({ page, isMobile }, info) => {
  const name = 'B Finanzen und Mails abarbeiten';
  await prepare(page, isMobile, financeScene);
  await planner(page);
  const before = await plannerRows(page);
  const hand = new Hand(page, isMobile);
  hand.start();
  const things = [
    ...INVOICES.map((i) => i.payee),
    ...SUBSCRIPTIONS.map((s) => s.name),
    'Budget',
    ...MAILS.map((m) => m.subject),
  ];
  // 1 The invoices: no tick in the plan (the late one's „Bezahlt …“ is a route to the invoice) – one trip to
  //   Rechnungen pays all three: „Als bezahlt markieren“ (and „Bezahlt“ where it asks).
  await go(hand, page, isMobile, 'invoices');
  for (const inv of INVOICES) {
    const row = page
      .locator('main li')
      .filter({ hasText: inv.payee })
      .filter({ has: page.getByRole('button', { name: 'Als bezahlt markieren' }) })
      .first();
    await hand.tap(
      row.getByRole('button', { name: 'Als bezahlt markieren' }),
      `Bezahlt: ${inv.payee}`,
      inv.payee,
    );
    const ask = page.getByRole('dialog', { name: `${inv.payee} bezahlt?` });
    if (await appears(ask, 1500)) {
      await hand.tap(
        ask.getByRole('button', { name: 'Bezahlt', exact: true }),
        'Bezahlt',
        inv.payee,
      );
      await expect(ask).toHaveCount(0);
    }
    await expect
      .poll(
        async () =>
          (await rows<{ id: string; status: string }>(page, 'invoices_invoice')).find(
            (r) => r.id === inv.id,
          )?.status,
      )
      .toBe('paid');
  }
  // 2 The cancellations: the module has no step of its own – cancelling is „Gekündigt zum“ in the entry. The one
  //   that goes: open it, the date, „Speichern“.
  const [cancel, keep] = SUBSCRIPTIONS;
  await go(hand, page, isMobile, 'subscriptions');
  await hand.tap(
    page.locator('main').getByText(cancel!.name, { exact: true }).first(),
    `Abo öffnen: ${cancel!.name}`,
    cancel!.name,
  );
  const editor = page.getByRole('dialog', { name: 'Abo bearbeiten' });
  await expect(editor).toBeVisible();
  await hand.fill(editor.getByLabel('Gekündigt zum (optional)'), '2026-12-10', 'Gekündigt zum', {
    thing: cancel!.name,
  });
  await hand.tap(
    editor.getByRole('button', { name: 'Speichern', exact: true }),
    'Speichern',
    cancel!.name,
  );
  await expect(editor).toHaveCount(0);
  // 3 The budget: never in the plan – a look on its page.
  await go(hand, page, isMobile, 'budgets', 'Budget');
  await expect(
    page
      .locator('main')
      .getByText(/drüber/)
      .first(),
  ).toBeVisible();
  // 4 The mails: no source of the plan – „Alle in den Plan…“ in the mailbox makes four ToDos (desktop only).
  let mails: number | string = 'nicht möglich';
  if (!isMobile) {
    await go(hand, page, isMobile, 'mail');
    await hand.tap(page.getByRole('button', { name: 'Alle in den Plan…' }), 'Alle in den Plan…');
    const all = page.getByRole('dialog', { name: 'In den Plan' });
    await hand.tap(all.getByRole('button', { name: /^In den Plan \(\d+\)$/ }), 'In den Plan (4)');
    hand.touch(MAILS.map((m) => m.subject));
    await expect(all).toHaveCount(0);
  }
  await go(hand, page, isMobile, 'planner');
  await expect(page.getByTestId(`day-${TODAY}`)).toBeVisible();
  if (!isMobile) {
    const fromMail = async () =>
      (await rows<Task>(page, 'todos_task')).filter(
        (x) => !x.done && x.links?.some((l) => l.kind === 'mail'),
      );
    await expect.poll(async () => (await fromMail()).length).toBe(MAILS.length);
    // They wait under „Noch ohne Tag“, where a row has no tick: each one onto today first, then ticked.
    const head = page.getByRole('button', { name: 'Noch ohne Tag ausklappen' });
    if (await head.count()) await hand.tap(head, 'Noch ohne Tag aufklappen');
    for (const todo of await fromMail()) {
      const subject = MAILS.find((m) => todo.title.includes(m.subject))!.subject;
      const tick = page.getByRole('checkbox', { name: `Erledigt: ${todo.title}`, exact: true });
      if (!(await tick.isVisible())) {
        await hand.tap(
          page.getByRole('button', { name: `Aktionen für ${todo.title}`, exact: true }).first(),
          `⋯ ${todo.title}`,
          subject,
        );
        const doneItem = page.getByRole('menuitem', { name: 'Erledigt', exact: true });
        if (await doneItem.count()) {
          await hand.tap(doneItem, 'Erledigt', subject);
          await expect
            .poll(async () => (await fromMail()).some((x) => x.id === todo.id))
            .toBe(false);
          continue;
        }
        await hand.tap(
          page.getByRole('menuitem', { name: 'Verschieben …' }),
          'Verschieben …',
          subject,
        );
        const move = page.getByRole('dialog', { name: `Verschieben: ${todo.title}` });
        await hand.tap(
          move.getByRole('button', { name: 'Mo 30.', exact: true }),
          'Mo 30.',
          subject,
        );
        await expect(move).toHaveCount(0);
      }
      const then = page.getByTestId(`day-${TODAY}`).getByRole('button', { name: /^Danach/ });
      if (!(await tick.isVisible()) && (await then.count()))
        if ((await then.getAttribute('aria-expanded')) === 'false')
          await hand.tap(then, 'Danach aufklappen');
      const more = page.getByTestId('planner-more');
      if (!(await tick.isVisible()) && (await more.count()))
        await hand.tap(more.first(), 'weitere zeigen');
      await hand.tap(tick, `Erledigt: ${todo.title}`, subject);
      await expect(tick).toHaveCount(0);
    }
    mails = (await fromMail()).length === 0 ? MAILS.length : 0;
  }
  // 5 The subscription that stays: „Nicht planen“ on its row in „Noch ohne Tag“ – decided, out of the plan.
  const head = page.getByRole('button', { name: 'Noch ohne Tag ausklappen' });
  if (await head.count()) await hand.tap(head, 'Noch ohne Tag aufklappen');
  const keepTitle = `${keep!.name} kündigen`;
  await hand.tap(
    page.getByRole('button', { name: `Aktionen für ${keepTitle}`, exact: true }).first(),
    `⋯ ${keepTitle}`,
    keep!.name,
  );
  await hand.tap(page.getByRole('menuitem', { name: 'Nicht planen' }), 'Nicht planen', keep!.name);
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  await planner(page);
  const after = await plannerRows(page);
  const afterText = await plannerText(page);
  record(
    info,
    name,
    {
      rowsBefore: before.all,
      taps: hand.taps,
      perThing: hand.perThing,
      moduleSwitches: hand.moduleSwitches,
      doneInPlanner: hand.onlyInPlanner(things),
      rowsAfter: after.all,
      mails,
    },
    {
      before,
      after,
      places: hand.places,
      path: hand.path,
      where: Object.fromEntries([...hand.where].map(([k, v]) => [k, [...v]])),
      afterText,
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------
// C  Bündel und Besorgung

const HOUSEHOLD = [
  'Wäsche anstellen',
  'Spülmaschine ausräumen',
  'Bad wischen',
  'Müll rausbringen',
  'Wäsche aufhängen',
];

/** The minutes a row of today's sheet shows („~30 Min“, „30 Min“). */
async function minutesOf(page: Page, title: string): Promise<number> {
  const row = page
    .getByTestId(`day-${TODAY}`)
    .locator('li')
    .filter({ has: page.getByRole('checkbox', { name: `Erledigt: ${title}`, exact: true }) })
    .first();
  const m = /(\d+) Min/.exec(await row.innerText());
  return m ? Number(m[1]) : 0;
}

test('C1 Bündel Haushalt', async ({ page, isMobile }, info) => {
  const name = 'C1 Bündel Haushalt';
  await prepare(page, isMobile);
  await planner(page);
  const hand = new Hand(page, isMobile);
  hand.start();
  // The planner knows no thing with steps („In Teile aufteilen“ cuts a long thing into sessions; a ToDo's subtasks are
  // never planned). The one thing with steps to tick one by one is a routine: Routinen · „Routine eintragen“ · name ·
  // steps (one typed line each) · save. „Im Planer zeigen“ is on by default, its day is today.
  await go(hand, page, isMobile, 'routines');
  await hand.tap(
    page.locator('[data-page-action]:visible, [data-testid="bottom-plus"]:visible').first(),
    'Routine eintragen',
  );
  const form = page.getByRole('dialog', { name: 'Routine eintragen' });
  await expect(form).toBeVisible();
  await hand.fill(form.getByLabel('Name', { exact: true }), 'Haushalt', 'Name');
  await hand.fill(form.getByLabel('Schritte (optional)'), HOUSEHOLD.join('\n'), '5 Schritte', {
    lines: HOUSEHOLD.length,
  });
  await hand.tap(form.getByRole('button', { name: 'Routine eintragen', exact: true }), 'Speichern');
  await expect(form).toHaveCount(0);
  await go(hand, page, isMobile, 'planner');
  const created = await plannerRows(page);
  const createTaps = hand.taps;
  const createSwitches = hand.moduleSwitches;
  // Working through it: the row's title opens the routine's steps („Los“) in Routinen; five ticks, the last one is
  // „Erledigt“ for the routine; back to the planner.
  const row = page
    .getByTestId(`day-${TODAY}`)
    .locator('li')
    .filter({ hasText: 'Haushalt' })
    .first();
  await expect(row).toBeVisible();
  await hand.tap(row.locator('button[data-row]').first(), 'Haushalt öffnen', 'Haushalt');
  const run = page.getByRole('dialog', { name: 'Haushalt' });
  await expect(run).toBeVisible();
  const stepsShown = await run.getByRole('checkbox').count();
  for (const step of HOUSEHOLD)
    await hand.tap(run.getByRole('checkbox', { name: step, exact: true }), step, 'Haushalt');
  await expect(run).toHaveCount(0);
  await go(hand, page, isMobile, 'planner');
  await expect.poll(() => onDay(page, TODAY)).toBe(0);
  const workTaps = hand.taps - createTaps;
  // The duration the planner proposes for a new thing, and whether one round with „Fokus starten“ (12 minutes,
  // „Fertig“) changes the next proposal for the same thing. Not counted in the figures above.
  const field = page.getByRole('textbox', { name: 'Eintragen oder sagen' });
  await field.fill('Wäsche anstellen');
  await field.press('Enter');
  await expect(
    page.getByRole('checkbox', { name: 'Erledigt: Wäsche anstellen', exact: true }),
  ).toBeVisible();
  const proposed = await minutesOf(page, 'Wäsche anstellen');
  await page.getByRole('button', { name: 'Aktionen für Wäsche anstellen', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Fokus starten' }).click();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.clock.setFixedTime(new Date(`${TODAY}T09:12:00`));
  await page.getByRole('button', { name: 'Fertig', exact: true }).click();
  await expect(page).toHaveURL(/\/planner$/);
  await expect
    .poll(async () => (await rows<Task>(page, 'todos_task')).filter((x) => x.done).length)
    .toBe(1);
  await field.fill('Wäsche anstellen');
  await field.press('Enter');
  await expect(
    page.getByRole('checkbox', { name: 'Erledigt: Wäsche anstellen', exact: true }),
  ).toBeVisible();
  const second = await minutesOf(page, 'Wäsche anstellen');
  const tasks = await rows<Task>(page, 'todos_task');
  record(
    info,
    name,
    {
      rows: created.all,
      createTaps,
      workTaps,
      taps: hand.taps,
      perThing: hand.perThing,
      moduleSwitches: hand.moduleSwitches,
      nextStepOnly: stepsShown <= 1 ? 'ja' : 'nein',
      savedAsRoutine: 'ja',
      durationProposed: proposed,
      learned: second !== proposed ? 'ja' : 'nein',
    },
    {
      created,
      createSwitches,
      stepsShown,
      second,
      estimates: tasks.map((x) => [x.title, x.done, x.estimateMin ?? null]),
      places: hand.places,
      path: hand.path,
    },
  );
});

const ERRANDS = ['Paket abholen (Post)', 'Altglas wegbringen'];
const DRUGSTORE = ['Zahnpasta', 'Duschgel', 'Taschentücher'];

test('C2 Besorgung', async ({ page, isMobile }, info) => {
  const name = 'C2 Besorgung';
  await prepare(page, isMobile, {
    todos_task: ERRANDS.map((title, i) => ({
      id: `e${i}`,
      listId: 'inbox',
      title,
      done: false,
      priority: 0,
      order: i,
      estimateMin: 20,
      plannedFor: TODAY,
      planMark: { date: TODAY, order: i },
    })),
    planner_assignment: ERRANDS.map((_, i) => ({
      id: `todos:e${i}#0`,
      itemKey: `todos:e${i}`,
      k: 0,
      of: 1,
      date: TODAY,
      minutes: 20,
      order: i,
      reason: 'new',
    })),
    lists_list: [{ id: 'drog', name: 'Drogerie', kind: 'shopping', order: 0 }],
    lists_item: DRUGSTORE.map((n, i) => ({
      id: `d${i}`,
      listId: 'drog',
      name: n,
      done: false,
      order: i,
    })),
  });
  await planner(page);
  const before = await plannerRows(page);
  // One row for the round? The row menu offers no bundling and no place on a map (read, not counted).
  await page.getByRole('button', { name: `Aktionen für ${ERRANDS[0]}`, exact: true }).click();
  const menu = await page.getByRole('menuitem').allInnerTexts();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  const hand = new Hand(page, isMobile);
  hand.start();
  // The list lives in Listen (the plan has it only after „In den Plan“ there): open it, tick three; back; tick the
  // two errands on today's sheet.
  await go(hand, page, isMobile, 'lists');
  // The only list opens by itself; with more lists it is one tap on its name.
  const first = page.getByRole('checkbox', { name: DRUGSTORE[0], exact: true });
  await expect(page.locator('main').getByText('Drogerie').first()).toBeVisible();
  if (!(await appears(first)))
    await hand.tap(
      page.locator('main').getByRole('button', { name: 'Drogerie', exact: true }).first(),
      'Liste Drogerie',
    );
  for (const item of DRUGSTORE)
    await hand.tap(page.getByRole('checkbox', { name: item, exact: true }), item, item);
  await expect
    .poll(
      async () => (await rows<{ done: boolean }>(page, 'lists_item')).filter((x) => x.done).length,
    )
    .toBe(3);
  await go(hand, page, isMobile, 'planner');
  for (const title of ERRANDS)
    await hand.tap(
      page.getByRole('checkbox', { name: `Erledigt: ${title}`, exact: true }),
      `Erledigt: ${title}`,
      title,
    );
  await expect.poll(() => onDay(page, TODAY)).toBe(0);
  record(
    info,
    name,
    {
      rows: before.all,
      // Getting the round into the plan as it is worked: nothing to do today (no bundle, the list stays out of the
      // plan – the path works it in Listen).
      createTaps: 0,
      workTaps: hand.taps,
      perThing: hand.perThing,
      moduleSwitches: hand.moduleSwitches,
      oneRow: menu.some((m) => /bündel|zusammen/i.test(m)) ? 'ja' : 'nein',
      mapShown: menu.some((m) => /Karte/i.test(m)) ? 'ja' : 'nicht möglich',
    },
    { before, menu, places: hand.places, path: hand.path },
  );
});

// ---------------------------------------------------------------------------------------------------------------
// D  Spuren des Plans in den Modulen, Teilen, Termine, Themen, Warten

/** A thing laid on a day by the planner (the row „Verschieben …“ writes: `<itemKey>#0`, whole). */
const laid = (itemKey: string, date: string, minutes: number, order: number) => ({
  id: `${itemKey}#0`,
  itemKey,
  k: 0,
  of: 1,
  date,
  minutes,
  order,
  reason: 'new',
});

const task = (id: string, title: string, order: number, extra: Record<string, unknown> = {}) => ({
  id,
  listId: 'inbox',
  title,
  done: false,
  priority: 0,
  order,
  estimateMin: 20,
  ...extra,
});

/** „Noch ohne Tag“ unfolded by the person (one tap while it is folded); waits for the board first. */
async function openNoDay(hand: Hand, page: Page) {
  await settled(() => noDay(page));
  const head = page.getByRole('button', { name: /^Noch ohne Tag (aus|ein)klappen$/ });
  if (!(await head.count())) return;
  if ((await head.getAttribute('aria-expanded')) === 'true') return;
  await hand.tap(head, 'Noch ohne Tag aufklappen');
  await expect(head).toHaveAttribute('aria-expanded', 'true');
}

/** The planner on a picked day of the week band (one tap when it is not the shown day). */
async function showDay(hand: Hand, page: Page, date: string) {
  const tile = page.getByTestId(`week-${date}`);
  if ((await tile.getAttribute('aria-pressed')) !== 'true') await hand.tap(tile, `Tag ${date}`);
  await expect(page.getByTestId(`day-${date}`)).toBeVisible();
}

/** What the open page (and its dialogs) says about the plan: every „im Plan“ with a little of its context. */
async function planMarks(page: Page): Promise<string[]> {
  await page.waitForTimeout(800);
  const text = [
    await page.locator('main').innerText(),
    ...(await page.getByRole('dialog').allInnerTexts()),
  ]
    .join(' ')
    .replace(/\s+/g, ' ');
  return [...new Set(text.match(/.{0,30}\b(im|Im) Plan\b.{0,30}/g) ?? [])];
}

/** A plan mark that names a day („Im Plan · Mi“, „im Plan: 2. Dez.“). */
const DAY_MARK =
  /\b(Im|im) Plan\s*[·:]?\s*(Mo|Di|Mi|Do|Fr|Sa|So|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|heute|morgen|\d)/;
const WED_MARK = /\b(Im|im) Plan\s*[·:]?\s*(Mi\b|Mittwoch|2\.)/;

const D1_THINGS: { key: string; title: string; module: Place; id: string }[] = [
  { key: 'invoices:i3', title: 'Musikschule Beispiel bezahlen', module: 'invoices', id: 'i3' },
  {
    key: 'lists:shopping-default',
    title: 'Einkaufen · 3 Dinge',
    module: 'lists',
    id: 'shopping-default',
  },
  { key: 'todos:nt', title: 'Regal im Flur', module: 'notes', id: 'n1' },
  {
    key: 'subscriptions:s1:2026-12-03',
    title: 'Streamingdienst Beispiel kündigen',
    module: 'subscriptions',
    id: 's1',
  },
  { key: 'bookmarks:bm1', title: 'Ausprobieren: Fahrradträger', module: 'bookmarks', id: 'bm1' },
];

test('D1 Steht es im Plan, und wann', async ({ page, isMobile }, info) => {
  const name = 'D1 Steht es im Plan, und wann';
  // Five things the planner laid on Wednesday (stored placement rows, as „Verschieben …“ in the planner writes them):
  // an invoice, the shopping list (asked into the plan), a note through its plan ToDo, a subscription's deadline and
  // a Merkliste entry – the subscription and the entry placed from the planner, not from their modules.
  await prepare(page, isMobile, {
    invoices_invoice: [INVOICES[2]!].map((i) => ({ ...i, status: 'open' })),
    subscriptions_subscription: [SUBSCRIPTIONS[0]!].map((s) => ({
      ...s,
      recurrence: { freq: 'monthly', interval: 1 },
      cancelNoticeDays: 7,
      active: true,
    })),
    lists_list: [{ id: 'shopping-default', name: 'Einkauf', kind: 'shopping', order: 0 }],
    lists_item: SHOPPING.map((n, i) => ({
      id: `s${i}`,
      listId: 'shopping-default',
      name: n,
      done: false,
      order: i,
    })),
    notes_note: [{ id: 'n1', title: 'Regal im Flur', body: 'Maße nehmen.', pinned: false }],
    todos_task: [
      task('nt', 'Regal im Flur', 0, {
        links: [{ kind: 'note', id: 'n1', label: 'Regal im Flur' }],
      }),
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
    planner_assignment: D1_THINGS.map((x, i) => laid(x.key, WEDNESDAY, 20, i)),
  });
  await planner(page);
  const hand = new Hand(page, isMobile);
  hand.start();
  const marks: Record<string, string[]> = {};
  let markVisible = 0;
  let markAgrees = 0;
  for (const thing of D1_THINGS) {
    await showDay(hand, page, WEDNESDAY);
    const row = page
      .getByTestId(`day-${WEDNESDAY}`)
      .locator('li')
      .filter({ hasText: thing.title })
      .first();
    const then = page.getByTestId(`day-${WEDNESDAY}`).getByRole('button', { name: /^Danach/ });
    if (!(await appears(row, 1500)) && (await then.count()))
      await hand.tap(then, 'Danach aufklappen');
    await expect(row).toBeVisible();
    // The note is reached through its ToDo's chip („Zur Notiz“), everything else through the row's title.
    const way =
      thing.module === 'notes'
        ? row.getByRole('button', { name: /Notiz/ }).first()
        : row.locator('button[data-row]').first();
    await hand.tap(way, `Öffnen: ${thing.title}`, thing.title);
    await expect(page).toHaveURL(new RegExp(`/${thing.module}`));
    await expect(page.locator('main h1')).toBeVisible();
    const said = await planMarks(page);
    marks[thing.title] = said;
    const day = said.some((l) => DAY_MARK.test(l));
    if (day) markVisible += 1;
    // Agrees with the plan: a mark that names Wednesday, or one that says „im Plan“ without naming another day.
    if (said.some((l) => WED_MARK.test(l)) || (said.length > 0 && !day)) markAgrees += 1;
    await page.keyboard.press('Escape');
    await go(hand, page, isMobile, 'planner');
  }
  // The other way round: starting on the thing in its own module, on which day is it planned? Readable there: no trip;
  // else to the planner, find its row (Wednesday), and back to the module (route changes counted).
  const first = {
    taps: hand.taps,
    perThing: hand.perThing,
    moduleSwitches: hand.moduleSwitches,
    places: [...hand.places],
  };
  let tripsToPlanner = 0;
  const trips: Record<string, string[]> = {};
  for (const thing of D1_THINGS) {
    await page.goto(`/${thing.module}?open=${encodeURIComponent(thing.id)}`);
    await expect(page.locator('main h1')).toBeVisible();
    const trip = new Hand(page, isMobile);
    trip.start();
    if ((await planMarks(page)).some((l) => DAY_MARK.test(l))) {
      trips[thing.title] = [];
      continue;
    }
    await page.keyboard.press('Escape');
    await go(trip, page, isMobile, 'planner');
    await showDay(trip, page, WEDNESDAY);
    await expect(
      page.getByTestId(`day-${WEDNESDAY}`).getByText(thing.title, { exact: true }).first(),
    ).toBeAttached();
    await go(trip, page, isMobile, thing.module);
    tripsToPlanner += trip.moduleSwitches;
    trips[thing.title] = trip.path;
  }
  record(
    info,
    name,
    {
      taps: first.taps,
      perThing: first.perThing,
      moduleSwitches: first.moduleSwitches,
      markVisible,
      markAgrees,
      tripsToPlanner,
    },
    { marks, trips, places: first.places, path: hand.path },
  );
});

test('D2 Geteilter Link in den Planer', async ({ page, isMobile }, info) => {
  const name = 'D2 Geteilter Link in den Planer';
  await prepare(page, isMobile);
  // The PWA's share target, opened directly: its form suggests the Merkliste – a plain link the planner never takes
  // (`bookmarks/plannable.ts`). „ToDo“ makes a thing the planner shows under „Noch ohne Tag“.
  await page.goto(
    '/share?title=Fahrradtr%C3%A4ger&text=https%3A%2F%2Fexample.org%2Ffahrradtraeger',
  );
  await expect(page.getByRole('radio', { name: 'ToDo' })).toBeVisible();
  const hand = new Hand(page, isMobile);
  hand.start();
  const forms = 1;
  await hand.tap(page.getByRole('radio', { name: 'ToDo' }), 'Ziel ToDo');
  await hand.tap(page.getByRole('button', { name: 'Speichern', exact: true }), 'Speichern');
  await expect.poll(async () => (await rows<Task>(page, 'todos_task')).length).toBe(1);
  const [saved] = await rows<Task & { note?: string }>(page, 'todos_task');
  await expect(page).not.toHaveURL(/\/share/);
  await go(hand, page, isMobile, 'planner');
  await openNoDay(hand, page);
  const row = page.locator('main li').filter({ hasText: 'Fahrradträger' }).first();
  const inPlanner = (await appears(row)) ? 'ja' : 'nein';
  // A way back to the address from the row: a link or a chip on it, or an entry of its ⋯ (read, not counted).
  let wayBack = 'nein';
  let menu: string[] = [];
  if (inPlanner === 'ja') {
    const onRow = await row
      .locator('a[href^="https://example.org"], button')
      .evaluateAll((els) =>
        els.map((e) => `${e.getAttribute('href') ?? ''} ${e.getAttribute('aria-label') ?? ''}`),
      );
    if (onRow.some((x) => /example\.org|Browser/.test(x))) wayBack = 'ja';
    await row.getByRole('button', { name: /^Aktionen für / }).click();
    menu = await page.getByRole('menuitem').allInnerTexts();
    await page.keyboard.press('Escape');
    if (menu.some((m) => /example\.org|Browser|Link/.test(m))) wayBack = 'ja';
  }
  record(
    info,
    name,
    { taps: hand.taps, moduleSwitches: hand.moduleSwitches, forms, inPlanner, wayBack },
    { saved, menu, places: hand.places, path: hand.path },
  );
});

test('D3 Vor einem Termin', async ({ page, isMobile }, info) => {
  const name = 'D3 Vor einem Termin';
  await prepare(page, isMobile, {
    calendar_event: [
      {
        id: 'ev1',
        title: 'Friseur',
        allDay: false,
        startDate: WEDNESDAY,
        startTime: '15:00',
        endTime: '16:00',
      },
    ],
  });
  await planner(page);
  const hand = new Hand(page, isMobile);
  hand.start();
  // The planner's field makes a ToDo without a link; the one link to an appointment is its editor's „Als ToDo
  // merken“ (a ToDo titled like the appointment, due that day). Renamed in its own editor, laid on Wednesday in the
  // planner.
  await go(hand, page, isMobile, 'calendar');
  const entry = page
    .getByRole('button', { name: /Friseur/ })
    .and(page.locator('xpath=//*[not(ancestor::aside)]'))
    .first();
  // The phone's month shows the day, not the entry: the day first.
  const shown = await entry
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (!shown)
    await hand.tap(
      page.getByRole('button', { name: /^Mittwoch, 2\. Dezember/ }).first(),
      'Tag Mi 2.',
    );
  await hand.tap(entry, 'Termin Friseur');
  const editor = page.getByRole('dialog').filter({ hasText: 'Als ToDo merken' });
  await expect(editor).toBeVisible();
  await hand.tap(editor.getByRole('button', { name: 'Als ToDo merken' }), 'Als ToDo merken');
  await expect.poll(async () => (await rows<Task>(page, 'todos_task')).length).toBe(1);
  await hand.tap(editor.getByRole('button', { name: 'Abbrechen' }), 'Schließen');
  await expect(editor).toHaveCount(0);
  await go(hand, page, isMobile, 'todos');
  const todoRow = page
    .locator('main')
    .getByRole('button', { name: /^Friseur/ })
    .first();
  await hand.tap(todoRow, 'ToDo Friseur');
  const todoEditor = page.getByRole('dialog', { name: 'Aufgabe bearbeiten' });
  if (!(await appears(todoEditor)))
    await hand.tap(
      page.locator('main').getByRole('button', { name: 'Bearbeiten' }).first(),
      'Bearbeiten',
    );
  await expect(todoEditor).toBeVisible();
  await hand.fill(todoEditor.getByRole('textbox', { name: 'Titel' }), 'Bargeld holen', 'Titel');
  await hand.tap(todoEditor.getByRole('button', { name: 'Speichern', exact: true }), 'Speichern');
  await expect(todoEditor).toHaveCount(0);
  await go(hand, page, isMobile, 'planner');
  await openNoDay(hand, page);
  await hand.tap(
    page.getByRole('button', { name: 'Aktionen für Bargeld holen', exact: true }).first(),
    '⋯ Bargeld holen',
  );
  await hand.tap(page.getByRole('menuitem', { name: 'Verschieben …' }), 'Verschieben …');
  const move = page.getByRole('dialog', { name: 'Verschieben: Bargeld holen' });
  await hand.tap(move.getByRole('button', { name: 'Mi 2.', exact: true }), 'Mi 2.');
  await expect(move).toHaveCount(0);
  const placed = await rows<{ itemKey: string; date: string }>(page, 'planner_assignment');
  // Linked: the appointment's editor names it under „Vorbereitung“ (read, not counted).
  await page.goto(`/calendar?open=ev1`);
  const back = page.getByRole('dialog').filter({ hasText: 'Als ToDo merken' });
  await expect(back).toBeVisible();
  const shows = await expect(back.getByText('Bargeld holen').first())
    .toBeVisible({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  const [todo] = await rows<Task & { dueDate?: string; plannedFor?: string }>(page, 'todos_task');
  record(
    info,
    name,
    {
      taps: hand.taps,
      perThing: hand.perThing,
      moduleSwitches: hand.moduleSwitches,
      linked: shows && todo?.links?.some((l) => l.kind === 'event') ? 'ja' : 'nein',
      onWednesday: placed.some((a) => a.date === WEDNESDAY) ? 'ja' : 'nein',
    },
    { todo, placed, places: hand.places, path: hand.path },
  );
});

const MOVE = [
  'Umzugskartons holen',
  'Nachsendeauftrag stellen',
  'Strom ummelden',
  'Helfer fragen',
  'Transporter buchen',
];
const OTHER = [
  'Wäsche',
  'Bad putzen',
  'Steuerordner sortieren',
  'Pflanzen gießen',
  'Fahrrad aufpumpen',
  'Mail an Kollegin',
  'Altpapier runterbringen',
  'Geschenk bestellen',
  'Schrank ausmisten',
  'Fenster putzen',
  'Paket abholen',
  'Arzttermin bestätigen',
  'Bericht lesen',
];
const WEEK = ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'];

test('D4 Ein Thema', async ({ page, isMobile }, info) => {
  const name = 'D4 Ein Thema';
  // This week: 18 ToDos laid on Monday to Friday (5 of them for the move), an invoice for the move laid on Thursday and
  // the appointment „Wohnungsübergabe“ on Friday – 20 things, 7 of „Umzug“.
  const todos = [...MOVE, ...OTHER].map((title, i) => task(`w${i}`, title, i));
  await prepare(page, isMobile, {
    todos_task: todos,
    invoices_invoice: [
      {
        id: 'mv',
        payee: 'Umzugsfirma Beispiel',
        amountMinor: 45000,
        dueDate: '2026-12-10',
        status: 'open',
      },
    ],
    calendar_event: [
      {
        id: 'ev-move',
        title: 'Wohnungsübergabe Umzug',
        allDay: false,
        startDate: '2026-12-04',
        startTime: '10:00',
        endTime: '11:00',
      },
    ],
    planner_assignment: [
      ...todos.map((x, i) => laid(`todos:${x.id}`, WEEK[i % WEEK.length]!, 20, i)),
      laid('invoices:mv', '2026-12-03', 10, 30),
    ],
  });
  await planner(page);
  // What the planner shows of the week: the things on the days (the tiles) and the appointments beside them. A view of
  // one topic only: a control that filters the plan (none today: every thing stays on its day).
  let onDays = 0;
  for (const date of WEEK) onDays += await settled(() => onDay(page, date));
  const appointments = await page.getByTestId('planner-appointments').locator('li').count();
  const filters = await page
    .locator('main')
    .getByRole('button', { name: /filter|thema/i })
    .count();
  const hand = new Hand(page, isMobile);
  hand.start();
  // Marking the five as belonging together: the ToDos' lists (no bulk step for a list or a tag – the selection
  // only offers „In den Plan …“): a list „Umzug“, then each ToDo's editor · „Liste“ · „Speichern“.
  await go(hand, page, isMobile, 'todos');
  await hand.tap(
    page.locator('main').getByRole('button', { name: 'Weitere Optionen' }).first(),
    'ToDos ⋯',
  );
  await hand.tap(page.getByRole('menuitem', { name: 'Neue Liste' }), 'Neue Liste');
  const listForm = page.getByRole('dialog');
  await hand.fill(listForm.getByRole('textbox').first(), 'Umzug', 'Name');
  await hand.tap(
    listForm.getByRole('button', { name: /^(Speichern|Anlegen|Liste anlegen|Erstellen)$/ }).last(),
    'Speichern',
  );
  await expect(listForm).toHaveCount(0);
  // The new list is shown (empty): back to all open ToDos.
  const allOpen = page.locator('main').getByRole('button', { name: 'Alle offenen' });
  // (The switch to the new list comes after the dialog has closed: wait for it, not for the rows it replaces.)
  if (await appears(allOpen, 5000)) await hand.tap(allOpen, 'Alle offenen');
  for (const title of MOVE) {
    await hand.tap(
      page
        .locator('main')
        .getByRole('button', { name: new RegExp(`^${title}`) })
        .first(),
      title,
      title,
    );
    const editor = page.getByRole('dialog', { name: 'Aufgabe bearbeiten' });
    if (!(await appears(editor)))
      await hand.tap(
        page.locator('main').getByRole('button', { name: 'Bearbeiten' }).first(),
        'Bearbeiten',
        title,
      );
    await expect(editor).toBeVisible();
    await hand.choose(editor.getByLabel('Liste', { exact: true }), 'Umzug', 'Liste Umzug', title);
    await hand.tap(
      editor.getByRole('button', { name: 'Speichern', exact: true }),
      'Speichern',
      title,
    );
    await expect(editor).toHaveCount(0);
  }
  await go(hand, page, isMobile, 'planner');
  const lists = await rows<{ id: string; name: string }>(page, 'todos_list');
  const umzug = lists.find((l) => l.name === 'Umzug');
  const inList = (await rows<Task & { listId: string }>(page, 'todos_task')).filter(
    (x) => x.listId === umzug?.id,
  ).length;
  record(
    info,
    name,
    {
      rows: filters > 0 ? 'Filter da – messen' : onDays + appointments,
      taps: hand.taps,
      perThing: hand.perThing,
      moduleSwitches: hand.moduleSwitches,
      planFilter: filters > 0 ? 'ja' : 'nein',
    },
    { onDays, appointments, filters, inList, places: hand.places, path: hand.path },
  );
  expect(inList).toBe(MOVE.length);
});

const WAITING = ['Antwort Vermieter abwarten', 'Rückmeldung Werkstatt', 'Angebot Maler abwarten'];

test('D5 Warte auf Antwort', async ({ page, isMobile }, info) => {
  const name = 'D5 Warte auf Antwort';
  const today = [...WAITING, 'Wäsche', 'Bad putzen'].map((title, i) =>
    task(`a${i}`, title, i, { plannedFor: TODAY, planMark: { date: TODAY, order: i } }),
  );
  await prepare(page, isMobile, {
    todos_task: today,
    planner_assignment: today.map((x, i) => laid(`todos:${x.id}`, TODAY, 20, i)),
  });
  await planner(page);
  const before = await settled(() => onDay(page, TODAY));
  const hand = new Hand(page, isMobile);
  hand.start();
  // The day's „Auswählen“: tick the three, „Auf einen Tag …“, Monday 7. (the planner's days reach two weeks).
  const sheet = page.getByTestId(`day-${TODAY}`);
  await hand.tap(
    page.getByRole('button', { name: 'Weitere Optionen', exact: true }).first(),
    'Tag ⋯',
  );
  await hand.tap(page.getByRole('menuitem', { name: 'Auswählen' }), 'Auswählen');
  for (const title of WAITING)
    await hand.tap(
      sheet
        .getByRole('checkbox', { name: `„${title}“ auswählen` })
        .or(
          sheet
            .locator('li')
            .filter({
              has: page.getByRole('button', { name: `Aktionen für ${title}`, exact: true }),
            })
            .getByRole('checkbox'),
        )
        .first(),
      `auswählen: ${title}`,
      title,
    );
  await hand.tap(page.getByRole('button', { name: 'Auf einen Tag …' }), 'Auf einen Tag …');
  const dialog = page.getByRole('dialog', { name: /^Verschieben: \d+ Dinge?$/ });
  await hand.tap(dialog.getByRole('button', { name: 'Mo 7.', exact: true }), 'Mo 7.');
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => onDay(page, TODAY)).toBe(before - WAITING.length);
  const after = await settled(() => onDay(page, TODAY));
  // Monday 7 December: are they on today's sheet by themselves?
  await page.clock.setFixedTime(new Date(`${NEXT_MONDAY}T09:00:00`));
  await page.goto('/planner');
  await expect(page.getByTestId(`week-${NEXT_MONDAY}`)).toBeVisible();
  await unfold(page);
  const back = (
    await Promise.all(
      WAITING.map((title) =>
        page.getByTestId(`day-${NEXT_MONDAY}`).getByText(title, { exact: true }).count(),
      ),
    )
  ).filter((n) => n > 0).length;
  record(
    info,
    name,
    {
      taps: hand.taps,
      perThing: hand.perThing,
      moduleSwitches: hand.moduleSwitches,
      rowsOffSheet: before - after,
      comesBackByItself: back === WAITING.length ? 'ja' : 'nein',
    },
    { before, after, back, places: hand.places, path: hand.path },
  );
});
