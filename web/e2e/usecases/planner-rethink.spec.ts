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
 * `IST` is the measured state: on `develop` before the rebuild (2026-11-21) U1 read 5 unasked moves, 5 untraceable
 * things, 17 repair taps in 3 passes and 4 + 1 collateral moves, and U2–U4 „nein“. Package 1 (`feat/plan-stays-put`)
 * brought it to the figures below: nothing moves unasked. Laying the week by hand now costs 31 taps instead of 8,
 * because nothing is spread beforehand (things start under „Noch ohne Tag“) – „Woche vorschlagen“ and dragging
 * (packages 5 and 6) bring that down. `TARGET` holds the values the rebuild has to reach (CONCEPT.md §8). Every
 * package re-measures `IST` for the paths it changes (`MEASURE=1` only measures); the last one switches the
 * assertion from `IST` to `TARGET`. The table lands in `test-results/usecase-planner-rethink.md`, the facts next
 * to it.
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

/** The measured state; a path fails when the planner behaves differently (then re-measure and say why). */
const IST: Record<string, Figures> = {
  'U1 Woche legen, zwei Tage verpassen, zurücklegen': {
    // Package 5 (2026-11-22): 31 → 11 – „Noch ohne Tag“ open once, then one drag per thing onto its day's tile.
    layTaps: 11,
    layCollateral: 0,
    unaskedAfterTwoDays: 0,
    untraceable: 0,
    // Package 3 (2026-11-22): 16 → 9 – the tab, then per passed day „Auswählen“ · „Alle“ · „Auf einen Tag …“ · day.
    repairTaps: 9,
    repairRounds: 1,
    collateral: 0,
    layoutReached: 'ja',
  },
  'U2 Neues am gewählten Tag': { landsOnChosenDay: 'ja', collateral: 0 },
  'U3 Neues an einem vollen Tag': { landsOnChosenDay: 'ja', collateral: 0 },
  'U4 Neues an einem freien Tag': { landsOnChosenDay: 'ja', collateral: 0 },
  // Package 4 (2026-11-22): „Verschieben …“ offers four weeks – ⋯ · „Verschieben …“ · the day; the grid shows it.
  'U5 Ding auf einen Tag in drei Wochen': {
    possible: 'ja',
    taps: 3,
    keys: 0,
    dayVisibleInPlanner: 'ja',
    collateral: 0,
  },
  // Package 2 (2026-11-22): the lock is one tap on the row (package 1: ⋯ and „Fest an diesem Tag“, 2 taps).
  'U6 Ding fest machen': { taps: 1, locked: 'ja', collateral: 0 },
  'U7 Alle auf heute': { taps: 1, onToday: 'ja', collateral: 0 },
};
/** What the rebuild has to reach. */
const TARGET: Record<string, Figures> = {
  'U1 Woche legen, zwei Tage verpassen, zurücklegen': {
    unaskedAfterTwoDays: 0,
    collateral: 0,
    layCollateral: 0,
    untraceable: 0,
    repairTaps: 10,
    repairRounds: 1,
    layoutReached: 'ja',
  },
  'U2 Neues am gewählten Tag': { landsOnChosenDay: 'ja', collateral: 0 },
  'U3 Neues an einem vollen Tag': { landsOnChosenDay: 'ja', collateral: 0 },
  'U4 Neues an einem freien Tag': { landsOnChosenDay: 'ja', collateral: 0 },
  'U5 Ding auf einen Tag in drei Wochen': {
    possible: 'ja',
    taps: 3,
    dayVisibleInPlanner: 'ja',
    collateral: 0,
  },
  'U6 Ding fest machen': { taps: 1, locked: 'ja', collateral: 0 },
  'U7 Alle auf heute': { taps: 1, onToday: 'ja', collateral: 0 },
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
  /** The day the fixed clock shows: a thing on an earlier day is found in the tab „Noch offen“. */
  today = MONDAY;
  constructor(private page: Page) {}
  /** The tab „Plan“ or „Noch offen“ (one tap when the other one is shown). */
  async tab(open: boolean) {
    const shown = await this.page.getByTestId('planner-open').count();
    if (!!shown === open) return;
    await this.tap(
      this.page
        .getByRole('navigation', { name: 'Ansicht' })
        .getByText(open ? /^Noch offen/ : /^Plan$/),
    );
  }
  /** A thing without a day sits in the folded group „Noch ohne Tag“: one tap opens it. */
  async unfold(title: string) {
    await this.tab(false);
    const menu = this.page.getByRole('button', { name: `Aktionen für ${title}`, exact: true });
    if (
      await menu
        .first()
        .isVisible()
        .catch(() => false)
    )
      return;
    await this.tap(this.page.getByRole('button', { name: /Noch ohne Tag ausklappen/ }));
    await expect(menu.first()).toBeVisible();
  }
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
    if (date < this.today) return this.tab(true);
    await this.tab(false);
    const shown = await this.page
      .locator('main [data-testid^="day-"]')
      .first()
      .getAttribute('data-testid');
    if (shown === `day-${date}`) return;
    await this.tap(this.page.getByTestId(`week-${date}`));
    await expect(this.page.getByTestId(`day-${date}`)).toBeVisible();
  }
  /**
   * Dragging a thing onto a day of the band (package 5): find it (open its day or „Noch ohne Tag“), then one
   * gesture – counted as one tap. Up to the band the pointer rests at the window's top edge (the page scrolls).
   * Returns false when the band shows no tile for that day.
   */
  async drag(title: string, to: string): Promise<boolean> {
    const at = (await layout(this.page))[title]?.split('+')[0];
    if (at) await this.show(at);
    else await this.unfold(title);
    const row = this.page
      .locator('li')
      .filter({
        has: this.page.getByRole('button', { name: `Aktionen für ${title}`, exact: true }),
      })
      .first();
    const handle = row.locator('[data-drag-unit]').first();
    const tile = this.page.getByTestId(`week-${to}`);
    if (!(await handle.count()) || !(await tile.count())) return false;
    await handle.scrollIntoViewIfNeeded();
    const a = (await handle.boundingBox())!;
    const height = this.page.viewportSize()!.height;
    this.taps += 1;
    await this.page.mouse.move(a.x + 10, a.y + a.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(a.x + 30, a.y + a.height / 2, { steps: 3 });
    for (let i = 0; i < 100; i++) {
      const b = await tile.boundingBox();
      if (b && b.y >= 0 && b.y + b.height <= height) break;
      await this.page.mouse.move(a.x + 30, 10);
      await this.page.waitForTimeout(50);
    }
    const b = (await tile.boundingBox())!;
    await this.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
    await this.page.mouse.up();
    return true;
  }
  /**
   * „Verschieben …“ of one thing onto a day: find it (open its day), row menu, „Verschieben …“, the day chip.
   * Returns false when the dialog does not offer that day.
   */
  async move(title: string, to: string): Promise<boolean> {
    const at = (await layout(this.page))[title]?.split('+')[0];
    if (at) await this.show(at);
    else await this.unfold(title);
    // „Noch offen“ (package 3): the row's own move button, no ⋯ – one tap less.
    const direct = this.page
      .getByTestId('planner-open')
      .getByRole('button', { name: `Verschieben: ${title}`, exact: true });
    if (at && at < this.today && (await direct.count())) await this.tap(direct.first());
    else {
      await this.tap(
        this.page.getByRole('button', { name: `Aktionen für ${title}`, exact: true }).first(),
      );
      await this.tap(this.page.getByRole('menuitem', { name: 'Verschieben …' }));
    }
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

/**
 * Every thing still open from one passed day onto one day, in one move (package 3): „Noch offen“ → „Auswählen“ →
 * the day's „Alle“ → „Auf einen Tag …“ → the day chip.
 */
async function moveDay(hand: Hand, page: Page, from: string, to: string) {
  await hand.tab(true);
  await hand.tap(page.getByTestId('open-actions').getByRole('button', { name: 'Auswählen' }));
  await hand.tap(page.getByRole('button', { name: `Alle von ${chipLabel(from)} auswählen` }));
  await hand.tap(page.getByRole('button', { name: 'Auf einen Tag …' }));
  const dialog = page.getByRole('dialog', { name: /^Verschieben: \d+ Dinge?$/ });
  await hand.tap(dialog.getByRole('button', { name: chipLabel(to), exact: true }));
  await expect(dialog).toHaveCount(0);
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
  // MEASURE=1 only measures (a package re-measures before it writes its figures into `IST`).
  if (process.env.MEASURE !== '1' && IST[name])
    expect(figures, `${name}: Ist-Zustand`).toEqual(IST[name]);
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
  await expect(page.locator('main h1')).toContainText('Planer');
  const auto = await settled(page);

  // 1. Lay out the week: every thing that is not where he wants it is dragged onto its day (package 5; before:
  // „Verschieben …“, 3 taps and the finding).
  const lay = new Hand(page);
  const layCollateral: string[] = [];
  for (const [title, to] of Object.entries(WANT)) {
    const before = await settled(page);
    if (before[title] === to) continue;
    expect(await lay.drag(title, to), `${title} → ${to}`).toBe(true);
    layCollateral.push(...changed(before, await settled(page), [title]));
  }
  const laid = await settled(page);

  // 2. Two days pass, nothing is ticked off. Wednesday morning he opens the planner.
  await page.clock.setFixedTime(new Date(`${MI}T08:00:00`));
  await page.reload();
  await expect(page.locator('main h1')).toContainText('Planer');
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
    const probe = new Hand(page);
    probe.today = MI;
    await probe.show(at);
    const row = page
      .getByTestId(at < MI ? 'planner-open' : `day-${at}`)
      .locator('li')
      .filter({ hasText: title })
      .first();
    await row.waitFor({ timeout: 5000 }).catch(() => undefined);
    // The trace of its day: the row's own words („war Mo“ among the fixed things) or the head of its group
    // („Mo 16.“) – read as the nearest heading above the row.
    traces[title] = (await row.count())
      ? await row.evaluate((li) => {
          let head = '';
          for (let el = li.parentElement; el && !head; el = el.parentElement)
            head =
              (
                el.querySelector(
                  ':scope > * h2, :scope > * h3, :scope > h2, :scope > h3',
                ) as HTMLElement | null
              )?.innerText ?? '';
          return `${head} · ${(li as HTMLElement).innerText}`.replace(/\s+/g, ' ');
        })
      : '(nicht gefunden)';
  }
  const untraceable = missed.filter(
    (k) => !/war (Mo|Di)|\b(Mo|Di) 1[67]\.|Montag|Dienstag/.test(traces[k]!),
  );
  await new Hand(page).tab(false);

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
  fix.today = MI;
  const repairCollateral: string[] = [];
  let rounds = 0;
  let reached = false;
  // A passed day whose things all go to one day is moved in one go (package 3: „Auswählen“, the day's „Alle“).
  for (const from of [...new Set(missed.map((k) => wednesday[k]!.split('+')[0]!))].sort()) {
    const things = missed.filter((k) => wednesday[k]!.split('+')[0] === from);
    const targets = new Set(things.map((k) => GOAL[k]));
    if (targets.size !== 1 || things.length < 2) continue;
    const before = await settled(page);
    await moveDay(fix, page, from, [...targets][0]!);
    repairCollateral.push(...changed(before, await settled(page), things));
  }
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

/**
 * The starting plan of the entry paths: the six things spread over the days (three on Monday, three on Tuesday)
 * through the page's „Woche vorschlagen“ – a proposal he takes; not counted, it only sets the scene.
 */
async function spread(page: Page) {
  await page.getByRole('button', { name: 'Weitere Optionen', exact: true }).first().click();
  await page.getByRole('menuitem', { name: 'Woche vorschlagen' }).click();
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(page.getByRole('button', { name: 'Übernehmen' })).toBeHidden();
  await expect.poll(async () => Object.keys(await layout(page)).length).toBe(SIX.length);
}

test('U2 Neues am gewählten Tag', async ({ page }, info) => {
  // Monday and Tuesday hold three things each, Thursday is empty and on the sheet.
  await prepare(page, SIX);
  await ready(page, '/planner');
  await expect(page.locator('main h1')).toContainText('Planer');
  await spread(page);
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
  await expect(page.locator('main h1')).toContainText('Planer');
  await spread(page);
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
  await expect(page.locator('main h1')).toContainText('Planer');
  await spread(page);
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
  await expect(page.locator('main h1')).toContainText('Planer');
  await spread(page);
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
  // Is the day there to look at (package 4: the switch „4 Wochen“ in the band's row; not counted – a look)?
  const gridSwitch = page.getByTestId('grid-switch');
  if (await gridSwitch.count()) await gridSwitch.click();
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

test('U6 Ding fest machen', async ({ page }, info) => {
  // „Steuer“ lies on the day on the sheet and shall be „fest“ there (CONCEPT §1: laid ⇄ locked in one tap).
  await prepare(page, SIX);
  await ready(page, '/planner');
  await expect(page.locator('main h1')).toContainText('Planer');
  await spread(page);
  const before = await settled(page);
  const hand = new Hand(page);
  const at = before['Steuer']!.split('+')[0]!;
  await hand.show(at);
  await hand.tap(page.getByRole('button', { name: 'Fest an diesem Tag: Steuer', exact: true }));
  await expect(page.getByRole('status').filter({ hasText: /^Fest am / })).toBeVisible();
  const after = await settled(page);
  const locked = (
    await rows<{ itemKey: string; locked?: boolean }>(page, 'planner_assignment')
  ).some((r) => r.itemKey === 'todos:r1' && r.locked === true);
  record(
    info,
    'U6 Ding fest machen',
    { taps: hand.taps, locked: locked ? 'ja' : 'nein', collateral: changed(before, after).length },
    { at, before, after },
  );
});

test('U7 Alle auf heute', async ({ page }, info) => {
  // Three things laid on Monday, nothing done; Wednesday he puts all of them on today in one move.
  const THREE = ['Angebot', 'Steuer', 'Keller'];
  await prepare(page, THREE);
  await ready(page, '/planner');
  await expect(page.locator('main h1')).toContainText('Planer');
  const lay = new Hand(page);
  for (const title of THREE) expect(await lay.move(title, MO)).toBe(true);
  await settled(page);
  await page.clock.setFixedTime(new Date(`${MI}T08:00:00`));
  await page.reload();
  await expect(page.locator('main h1')).toContainText('Planer');
  const before = await settled(page);
  const hand = new Hand(page);
  hand.today = MI;
  // Finding the tab is the scene (the line on today, or the tab); the move itself is what is counted.
  await hand.tab(true);
  hand.taps = 0;
  await hand.tap(page.getByTestId('open-actions').getByRole('button', { name: 'Alle auf heute' }));
  await expect(
    page.getByRole('status').filter({ hasText: 'Alles liegt auf heute.' }),
  ).toBeVisible();
  const after = await settled(page);
  record(
    info,
    'U7 Alle auf heute',
    {
      taps: hand.taps,
      onToday: THREE.every((k) => after[k] === MI) ? 'ja' : 'nein',
      collateral: changed(before, after, THREE).length,
    },
    { before, after },
  );
});
