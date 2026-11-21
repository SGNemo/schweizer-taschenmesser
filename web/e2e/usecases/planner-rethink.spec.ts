import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { ready } from '../helpers';

/**
 * Use case „Planer neu gedacht“ (docs/design/planner-rethink/ANALYSIS.md): the maintainer lays out a week by
 * hand, misses two days, looks for the missed things and puts the plan back. The script counts what the
 * planner does that he did not ask for:
 *  - `unasked`: things that sit on another day than the one he put them on, without an action of his,
 *  - `collateral`: things that change their day while he moves a different thing,
 *  - `taps`: handles he needs for the repair (finding a thing counts: one tap per day tile he has to open),
 *  - `untraceable`: missed things whose row says nothing about the day they were meant for.
 * Plus four entry paths: a new thing on a chosen day, on a full day, on a day off, and on a day in three weeks.
 *
 * `IST` is the state measured on `develop` (2026-11-21); the script is green against it. `TARGET` holds the
 * values the rebuild has to reach (CONCEPT.md §10); package 7 of PACKAGES.md switches the assertion from `IST`
 * to `TARGET`. The table lands in `test-results/usecase-planner-rethink.md`, the facts next to it.
 *
 *   npx playwright test e2e/usecases/planner-rethink.spec.ts --project=desktop-chrome --trace off
 */

const OUT = 'test-results/usecase-planner-rethink';
const MONDAY = '2026-11-16';
const day = (offset: number) => {
  const d = new Date(`${MONDAY}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const [MO, DI, MI, DO, FR] = [0, 1, 2, 3, 4].map(day) as [string, string, string, string, string];
const IN_THREE_WEEKS = day(21);

type Figures = Record<string, number | string>;

/** Measured on `develop`; a path fails when the planner behaves differently (then re-measure and say why). */
const IST: Record<string, Figures> = {
  'U1 Woche legen, zwei Tage verpassen, zurücklegen': {
    layTaps: 8,
    layCollateral: 1,
    unaskedAfterTwoDays: 5,
    untraceable: 5,
    repairTaps: 17,
    repairRounds: 3,
    collateral: 4,
    layoutReached: 'ja',
  },
  'U2 Neues am gewählten Tag': { landsOnChosenDay: 'nein', collateral: 0 },
  'U3 Neues an einem vollen Tag': { landsOnChosenDay: 'nein', collateral: 0 },
  'U4 Neues an einem freien Tag': { landsOnChosenDay: 'nein', collateral: 0 },
  'U5 Ding auf einen Tag in drei Wochen': {
    possible: 'nein',
    taps: 2,
    keys: 25,
    dayVisibleInPlanner: 'nein',
    collateral: 0,
  },
};
/** What the rebuild has to reach. */
const TARGET: Record<string, Figures> = {
  'U1 Woche legen, zwei Tage verpassen, zurücklegen': {
    unaskedAfterTwoDays: 0,
    collateral: 0,
    layCollateral: 0,
    untraceable: 0,
    repairTaps: 3,
    repairRounds: 1,
    layoutReached: 'ja',
  },
  'U2 Neues am gewählten Tag': { landsOnChosenDay: 'ja', collateral: 0 },
  'U3 Neues an einem vollen Tag': { landsOnChosenDay: 'ja', collateral: 0 },
  'U4 Neues an einem freien Tag': { landsOnChosenDay: 'ja', collateral: 0 },
  'U5 Ding auf einen Tag in drei Wochen': {
    possible: 'ja',
    taps: 4,
    dayVisibleInPlanner: 'ja',
    collateral: 0,
  },
};

const base = { createdAt: 1, updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };

/** An empty install with ToDos and planner on and the given open ToDos (60 min each): no seed, no settings. */
async function prepare(page: Page, titles: readonly string[]) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    ({ titles, base }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['_modules', 'todos_list', 'todos_task'], 'readwrite');
          for (const id of ['todos', 'planner'])
            tx.objectStore('_modules').put({ ...base, id, enabled: true, dataPolicy: null });
          tx.objectStore('todos_list').put({ ...base, id: 'inbox', name: 'Eingang', order: 0 });
          titles.forEach((title, i) =>
            tx.objectStore('todos_task').put({
              ...base,
              id: `r${i}`,
              listId: 'inbox',
              done: false,
              priority: 0,
              order: i,
              estimateMin: 60,
              title,
            }),
          );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { titles: [...titles], base },
  );
}

async function rows<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    (store) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(new Error('IndexedDB taschenmesser'));
        open.onsuccess = () => {
          const req = open.result.transaction(store).objectStore(store).getAll();
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

/** Where every thing sits: title → its days (sorted), read from the stored plan. A thing on no day is absent. */
async function layout(page: Page): Promise<Record<string, string>> {
  const [assignments, tasks] = await Promise.all([
    rows<{ itemKey: string; date: string }>(page, 'planner_assignment'),
    rows<{ id: string; title: string }>(page, 'todos_task'),
  ]);
  const out: Record<string, string[]> = {};
  for (const a of assignments) {
    const title = tasks.find((t) => `todos:${t.id}` === a.itemKey)?.title ?? a.itemKey;
    (out[title] ??= []).push(a.date);
  }
  return Object.fromEntries(
    Object.entries(out)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, v.sort().join('+')]),
  );
}

/** The stored plan once two reads 500 ms apart agree (a run is debounced by 50 ms and may write in steps). */
async function settled(page: Page): Promise<Record<string, string>> {
  let last = '';
  let now: Record<string, string> = {};
  await expect
    .poll(
      async () => {
        now = await layout(page);
        const same = JSON.stringify(now) === last;
        last = JSON.stringify(now);
        return same;
      },
      { intervals: [500], timeout: 20_000 },
    )
    .toBe(true);
  return now;
}

/** Things whose day differs between two layouts, except the ones the person moved on purpose. */
const changed = (
  before: Record<string, string>,
  after: Record<string, string>,
  except: readonly string[] = [],
) =>
  [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((k) => !except.includes(k) && before[k] !== after[k])
    .map((k) => `${k}: ${before[k] ?? '–'} → ${after[k] ?? 'wartet'}`);

class Hand {
  taps = 0;
  keys = 0;
  constructor(private page: Page) {}
  async tap(target: Locator) {
    this.taps += 1;
    await target.click();
  }
  async type(target: Locator, text: string) {
    this.keys += text.length + 1;
    await target.fill(text);
    await target.press('Enter');
  }
  /** Opens the day a thing sits on (one tap on its tile; none when that day is already shown). */
  async show(date: string) {
    const shown = await this.page
      .locator('main [data-testid^="day-"]')
      .first()
      .getAttribute('data-testid');
    if (shown === `day-${date}`) return;
    await this.tap(this.page.getByTestId(`week-${date}`));
    await expect(this.page.getByTestId(`day-${date}`)).toBeVisible();
  }
  /**
   * „Verschieben …“ of one thing onto a day: find it (open its day), row menu, „Verschieben …“, the day chip.
   * Returns false when the dialog does not offer that day.
   */
  async move(title: string, to: string): Promise<boolean> {
    const at = (await layout(this.page))[title]?.split('+')[0];
    if (at) await this.show(at);
    await this.tap(
      this.page.getByRole('button', { name: `Aktionen für ${title}`, exact: true }).first(),
    );
    await this.tap(this.page.getByRole('menuitem', { name: 'Verschieben …' }));
    const dialog = this.page.getByRole('dialog', { name: `Verschieben: ${title}` });
    await expect(dialog).toBeVisible();
    const chip = dialog.locator(`[data-date="${to}"], [data-testid="move-${to}"]`).first();
    const byLabel = dialog.getByRole('button', { name: chipLabel(to), exact: true });
    const target = (await chip.count()) ? chip : byLabel;
    if (!(await target.count())) {
      await this.page.keyboard.press('Escape');
      return false;
    }
    await this.tap(target);
    await expect(dialog).toHaveCount(0);
    return true;
  }
}

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
/** The chip of a day in „Verschieben …“ („Do 19.“). */
function chipLabel(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return `${WD[d.getDay()]} ${d.getDate()}.`;
}

function record(info: TestInfo, name: string, figures: Figures, facts: unknown) {
  mkdirSync(OUT, { recursive: true });
  const key = name.slice(0, 2);
  writeFileSync(`${OUT}/${key}-${info.project.name}.json`, JSON.stringify({ name, figures }));
  writeFileSync(`${OUT}/${key}-${info.project.name}-facts.json`, JSON.stringify(facts, null, 1));
  const lines = readdirSync(OUT)
    .filter((f) => /^U\d-[^-]+(-[^-]+)?\.json$/.test(f) && !f.endsWith('-facts.json'))
    .sort()
    .flatMap((f) => {
      const row = JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')) as {
        name: string;
        figures: Figures;
      };
      return Object.entries(row.figures).map(
        ([k, v]) => `| ${row.name} | ${k} | ${v} | ${TARGET[row.name]?.[k] ?? '–'} |`,
      );
    });
  writeFileSync(
    `${OUT}.md`,
    ['| Pfad | Messgröße | Ist | Ziel |', '| --- | --- | --- | --- |', ...lines, ''].join('\n'),
  );
  info.annotations.push({ type: 'usecase', description: `${name}: ${JSON.stringify(figures)}` });
  console.log(name, JSON.stringify(figures));
  if (IST[name]) expect(figures, `${name}: Ist-Zustand auf develop`).toEqual(IST[name]);
}

test.beforeEach(async ({ page }, info) => {
  // Measured with the mouse on the desktop; the phone gets its own figures with the rebuild (package 7).
  test.skip(info.project.name !== 'desktop-chrome', 'desktop only');
  test.setTimeout(240_000);
  await page.clock.setFixedTime(new Date(`${MONDAY}T08:00:00`));
});

test('U1 Woche legen, zwei Tage verpassen, zurücklegen', async ({ page }, info) => {
  const name = 'U1 Woche legen, zwei Tage verpassen, zurücklegen';
  // Ten things of one hour. What he wants: three on Monday, two on Tuesday, three on Wednesday, one each on
  // Thursday and Friday.
  const WANT: Record<string, string> = {
    Angebot: MO,
    Steuer: MO,
    Keller: MO,
    Blogpost: DI,
    Fahrrad: DI,
    Geschenk: MI,
    Arzt: MI,
    Rechnung: MI,
    Vortrag: DO,
    Werkstatt: FR,
  };
  await prepare(page, Object.keys(WANT));
  await ready(page, '/planner');
  await expect(page.getByTestId('planner-head')).toBeVisible();
  const auto = await settled(page);

  // 1. Lay out the week: every thing that is not where he wants it is moved there („Verschieben …“).
  const lay = new Hand(page);
  const layCollateral: string[] = [];
  for (const [title, to] of Object.entries(WANT)) {
    const before = await settled(page);
    if (before[title] === to) continue;
    expect(await lay.move(title, to), `${title} → ${to}`).toBe(true);
    layCollateral.push(...changed(before, await settled(page), [title]));
  }
  const laid = await settled(page);

  // 2. Two days pass, nothing is ticked off. Wednesday morning he opens the planner.
  await page.clock.setFixedTime(new Date(`${MI}T08:00:00`));
  await page.reload();
  await expect(page.getByTestId('planner-head')).toBeVisible();
  await page.waitForTimeout(1500);
  const wednesday = await settled(page);
  const unasked = changed(laid, wednesday);

  // 3. The missed things (Monday's and Tuesday's): does their row say where they were meant to be?
  const missed = Object.keys(WANT).filter((k) => WANT[k]! < MI);
  const traces: Record<string, string> = {};
  for (const title of missed) {
    const at = wednesday[title]?.split('+')[0];
    if (!at) {
      traces[title] = '(auf keinem Tag)';
      continue;
    }
    await page.getByTestId(`week-${at}`).click();
    const row = page.getByTestId(`day-${at}`).locator('li').filter({ hasText: title }).first();
    traces[title] = (await row.count())
      ? (await row.innerText()).replace(/\s+/g, ' ')
      : '(nicht gefunden)';
  }
  const untraceable = missed.filter(
    (k) => !/verpasst|weiter von|war (Mo|Di)|Montag|Dienstag/i.test(traces[k]!),
  );
  await page.getByTestId(`week-${MI}`).click();

  // 4. Put it back: Wednesday to Friday as laid; Monday's things to Thursday, Tuesday's to Friday.
  const GOAL: Record<string, string> = {
    ...WANT,
    Angebot: DO,
    Steuer: DO,
    Keller: DO,
    Blogpost: FR,
    Fahrrad: FR,
  };
  const fix = new Hand(page);
  const repairCollateral: string[] = [];
  let rounds = 0;
  let reached = false;
  while (rounds < 4 && !reached) {
    rounds += 1;
    for (const [title, to] of Object.entries(GOAL)) {
      const before = await settled(page);
      if (before[title] === to) continue;
      if (!(await fix.move(title, to))) continue;
      repairCollateral.push(...changed(before, await settled(page), [title]));
    }
    reached =
      JSON.stringify(await settled(page)) ===
      JSON.stringify(
        Object.fromEntries(Object.entries(GOAL).sort(([a], [b]) => a.localeCompare(b))),
      );
  }
  const end = await settled(page);
  record(
    info,
    name,
    {
      layTaps: lay.taps,
      layCollateral: layCollateral.length,
      unaskedAfterTwoDays: unasked.length,
      untraceable: untraceable.length,
      repairTaps: fix.taps,
      repairRounds: rounds,
      collateral: repairCollateral.length,
      layoutReached: reached ? 'ja' : 'nein',
    },
    { auto, laid, wednesday, unasked, traces, repairCollateral, layCollateral, end, GOAL },
  );
});

/** Types one new thing into the planner's field while `shown` is the day on the sheet; returns where it landed. */
async function enter(page: Page, hand: Hand, shown: string, text: string, title: string) {
  await hand.show(shown);
  const before = await settled(page);
  await hand.type(page.getByRole('textbox', { name: 'Eintragen oder sagen' }), text);
  await expect
    .poll(async () => (await layout(page))[title] ?? (await waits(page, title)))
    .toBeTruthy();
  const after = await settled(page);
  return { landed: after[title] ?? 'wartet', collateral: changed(before, after, [title]) };
}

/** Is the thing in the plan's input but on no day („Wartet auf freie Zeit“)? */
async function waits(page: Page, title: string): Promise<string | undefined> {
  const tasks = await rows<{ title: string }>(page, 'todos_task');
  return tasks.some((t) => t.title === title) ? 'wartet' : undefined;
}

const SIX = ['Angebot', 'Steuer', 'Keller', 'Blogpost', 'Fahrrad', 'Geschenk'];

test('U2 Neues am gewählten Tag', async ({ page }, info) => {
  // Monday and Tuesday hold three things each, Thursday is empty and on the sheet.
  await prepare(page, SIX);
  await ready(page, '/planner');
  await expect(page.getByTestId('planner-head')).toBeVisible();
  await settled(page);
  const hand = new Hand(page);
  const r = await enter(page, hand, DO, 'Zahnarzt anrufen', 'Zahnarzt anrufen');
  record(
    info,
    'U2 Neues am gewählten Tag',
    { landsOnChosenDay: r.landed === DO ? 'ja' : 'nein', collateral: r.collateral.length },
    { chosen: DO, ...r },
  );
});

test('U3 Neues an einem vollen Tag', async ({ page }, info) => {
  // Today holds three things of an hour (12 minutes free); the new thing takes an hour.
  await prepare(page, SIX);
  await ready(page, '/planner');
  await expect(page.getByTestId('planner-head')).toBeVisible();
  await settled(page);
  const hand = new Hand(page);
  const r = await enter(page, hand, MO, 'Paket abholen 1 Std', 'Paket abholen');
  record(
    info,
    'U3 Neues an einem vollen Tag',
    { landsOnChosenDay: r.landed === MO ? 'ja' : 'nein', collateral: r.collateral.length },
    { chosen: MO, ...r },
  );
});

test('U4 Neues an einem freien Tag', async ({ page }, info) => {
  // Thursday is a day off („Donnerstag frei“); he still wants one thing there.
  await prepare(page, SIX);
  await ready(page, '/planner');
  await expect(page.getByTestId('planner-head')).toBeVisible();
  await settled(page);
  const field = page.getByRole('textbox', { name: 'Eintragen oder sagen' });
  await field.fill('Donnerstag frei');
  await field.press('Enter');
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(page.getByRole('button', { name: 'Übernehmen' })).toBeHidden();
  await settled(page);
  const hand = new Hand(page);
  const r = await enter(page, hand, DO, 'Blumen gießen', 'Blumen gießen');
  record(
    info,
    'U4 Neues an einem freien Tag',
    { landsOnChosenDay: r.landed === DO ? 'ja' : 'nein', collateral: r.collateral.length },
    { chosen: DO, ...r },
  );
});

test('U5 Ding auf einen Tag in drei Wochen', async ({ page }, info) => {
  // „Angebot“ shall sit on Monday in three weeks. Ways tried: „Verschieben …“ (does the dialog offer the day?)
  // and the sentence „schieb Angebot auf 7.12.“.
  await prepare(page, SIX);
  await ready(page, '/planner');
  await expect(page.getByTestId('planner-head')).toBeVisible();
  const before = await settled(page);
  const hand = new Hand(page);
  const byMenu = await hand.move('Angebot', IN_THREE_WEEKS);
  let sentence = '';
  if (!byMenu) {
    const field = page.getByRole('textbox', { name: 'Eintragen oder sagen' });
    await hand.type(field, 'schieb Angebot auf 7.12.');
    const apply = page.getByRole('button', { name: 'Übernehmen' });
    if (await apply.isVisible().catch(() => false)) {
      sentence = (await page.getByTestId('plan-preview').innerText()).replace(/\s+/g, ' ');
      await hand.tap(apply);
    }
    await page.waitForTimeout(800);
  }
  const after = await settled(page);
  const bySentence = after['Angebot'] === IN_THREE_WEEKS;
  const weekTile = await page.getByTestId(`week-${IN_THREE_WEEKS}`).count();
  record(
    info,
    'U5 Ding auf einen Tag in drei Wochen',
    {
      possible: byMenu || bySentence ? 'ja' : 'nein',
      taps: hand.taps,
      keys: hand.keys,
      dayVisibleInPlanner: weekTile ? 'ja' : 'nein',
      collateral: changed(before, after, ['Angebot']).length,
    },
    { byMenu, bySentence, sentence, landed: after['Angebot'] ?? 'wartet', before, after },
  );
});
