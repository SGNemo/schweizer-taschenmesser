import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

/**
 * Use case „Tag kippt“ (docs/design/usecases/tag-kippt/ANALYSIS.md): a weekend plan of 20 invented things over
 * Saturday and Sunday; nothing is done by Saturday 16:00. The person shrinks the plan three times and once takes a
 * plan he split up outside the app. Per path the script counts:
 *  - `taps`: handles (a tap, a paste, a typed line each count one),
 *  - `perThing`: handles that act on one single thing of the ones that go away (the „Einzelgriff je Ding“),
 *  - `visibleToday`: thing rows on today's sheet afterwards,
 *  - `lost`: things that are neither open in ToDos nor done (gone without a trace),
 *  - `duplicates`: titles that exist twice as open ToDos,
 *  - `unasked`: things whose day changed without an action that named them or their day.
 *
 * `IST` is the measured state of the path the script finds (it takes the best path the app offers: a new control is
 * used as soon as it is there). `TARGET` is TARGET.md. Every build PR re-measures `IST` (never loosened); a figure is
 * asserted against the better of its `IST` and – once reached – its `TARGET`. `MEASURE=1` only measures.
 *
 *   npx playwright test e2e/usecases/tag-kippt.spec.ts --project=desktop-chrome --trace off
 */

const OUT = 'test-results/usecase-tag-kippt';
const SA = '2026-11-28';
const SO = '2026-11-29';
const MO = '2026-11-30';

type Figures = Record<string, number | string>;

/**
 * The measured state. 2026-11-23 on `develop` (b62a48e2): T1 and T2 by the day's „Auswählen“ (untick what stays) and,
 * for the next weeks, the ToDos board (⋯ · „Verschieben nach Irgendwann“ per thing – the planner has no such step);
 * T4 by the ToDos' JSON import plus „Hierher legen“ – a moved or postponed thing comes back as a second ToDo.
 */
const IST: Record<string, Figures> = {
  'T1 Samstag 16:00 – ab jetzt neu': {
    taps: 9,
    perThing: 4,
    visibleToday: 4,
    startPoint: 'nein',
    smallerInOneMove: 'nein',
    lost: 0,
    unasked: 0,
  },
  'T2 Samstagabend – 5 / 6 / 9': {
    taps: 31,
    perThing: 23,
    laterInPlanner: 'nein',
    visibleToday: 5,
    startPoint: 'nein',
    lost: 0,
    unasked: 0,
  },
  'T3 Montag – letzter Stand, neu legen': {
    taps: 2,
    perThing: 0,
    countsShown: 0,
    visibleToday: 8,
    lost: 0,
  },
  // „Plan einfügen“ (feat/plan-einfuegen): field · paste · „Übernehmen“; the second paste (JSON, two things swapped)
  // doubles nothing.
  'T4 Plan von außen übernehmen': {
    taps: 3,
    perThing: 0,
    textPossible: 'ja',
    onTheirDay: 11,
    duplicates: 0,
    secondDuplicates: 0,
    swapped: 'ja',
    lost: 0,
  },
};

/** What the target picture asks (TARGET.md §1). */
const TARGET: Record<string, Figures> = {
  'T1 Samstag 16:00 – ab jetzt neu': {
    taps: 8,
    perThing: 0,
    visibleToday: 4,
    startPoint: 'ja',
    smallerInOneMove: 'ja',
    lost: 0,
    unasked: 0,
  },
  'T2 Samstagabend – 5 / 6 / 9': {
    taps: 22,
    perThing: 0,
    laterInPlanner: 'ja',
    visibleToday: 5,
    startPoint: 'ja',
    lost: 0,
    unasked: 0,
  },
  'T3 Montag – letzter Stand, neu legen': {
    taps: 2,
    perThing: 0,
    countsShown: 0,
    visibleToday: 8,
    lost: 0,
  },
  'T4 Plan von außen übernehmen': {
    taps: 3,
    perThing: 0,
    textPossible: 'ja',
    onTheirDay: 11,
    duplicates: 0,
    secondDuplicates: 0,
    swapped: 'ja',
    lost: 0,
  },
};

const base = { createdAt: 1, updatedAt: 1, deviceId: 'e2e', deletedAt: null, _f: {} };

/** The weekend as it was laid on Friday: ten things on Saturday, ten on Sunday (invented, neutral). */
const SATURDAY = [
  'Pfand wegbringen',
  'Wäsche waschen',
  'Küche aufräumen',
  'Paket abholen',
  'Nachricht an Vermieter',
  'Stromrechnung prüfen',
  'Flur saugen',
  'Altpapier runterbringen',
  'Bericht Kapitel 2 lesen',
  'Einkaufsliste schreiben',
] as const;
const SUNDAY = [
  'Bad putzen',
  'Fenster Wohnzimmer',
  'Dauerauftrag Miete prüfen',
  'Mail an Kollegin',
  'Schrank ausmisten',
  'Pflanzen gießen',
  'Fahrrad aufpumpen',
  'Steuerordner sortieren',
  'Geschenk bestellen',
  'Wochenplan Arbeit',
] as const;
const ALL: string[] = [...SATURDAY, ...SUNDAY];

/** Step 2's split: five on Saturday, six on Sunday, nine for the next weeks (invented). */
const KEEP_SA = [
  'Pfand wegbringen',
  'Wäsche waschen',
  'Küche aufräumen',
  'Flur saugen',
  'Altpapier runterbringen',
];
const KEEP_SO = [
  'Bad putzen',
  'Schrank ausmisten',
  'Pflanzen gießen',
  'Einkaufsliste schreiben',
  'Paket abholen',
  'Fenster Wohnzimmer',
];
const LATER = ALL.filter((t) => !KEEP_SA.includes(t) && !KEEP_SO.includes(t));

/** An install with ToDos and planner on and the weekend laid: every thing on its day, mirrored to its ToDo. */
async function prepare(page: Page, at: string) {
  await page.clock.setFixedTime(new Date(at));
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    ({ sa, so, base, SA, SO }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(
            ['_modules', 'todos_list', 'todos_task', 'planner_assignment'],
            'readwrite',
          );
          for (const id of ['todos', 'planner'])
            tx.objectStore('_modules').put({ ...base, id, enabled: true, dataPolicy: null });
          tx.objectStore('todos_list').put({ ...base, id: 'inbox', name: 'Eingang', order: 0 });
          const lay = (titles: string[], date: string, from: number) =>
            titles.forEach((title, i) => {
              const id = `w${from + i}`;
              tx.objectStore('todos_task').put({
                ...base,
                id,
                listId: 'inbox',
                done: false,
                priority: 0,
                order: from + i,
                estimateMin: 30,
                title,
                plannedFor: date,
                planMark: { date, order: i },
              });
              tx.objectStore('planner_assignment').put({
                ...base,
                id: `todos:${id}#0`,
                itemKey: `todos:${id}`,
                k: 0,
                of: 1,
                date,
                minutes: 30,
                order: i,
                reason: 'new',
              });
            });
          lay(sa, SA, 0);
          lay(so, SO, 10);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { sa: [...SATURDAY], so: [...SUNDAY], base, SA, SO },
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

interface Task {
  id: string;
  title: string;
  done: boolean;
  someday?: boolean;
  plannedFor?: string;
}

/** Where every open thing is: title → its day(s) in the plan, „später“ for the next weeks, „ohne Tag“ else. */
async function where(page: Page): Promise<Record<string, string>> {
  const [assignments, tasks] = await Promise.all([
    rows<{ itemKey: string; date: string }>(page, 'planner_assignment'),
    rows<Task>(page, 'todos_task'),
  ]);
  const out: Record<string, string> = {};
  for (const task of tasks.filter((x) => !x.done)) {
    const days = assignments
      .filter((a) => a.itemKey === `todos:${task.id}`)
      .map((a) => a.date)
      .sort();
    const at = task.someday ? 'später' : days.length ? days.join('+') : 'ohne Tag';
    out[task.title] = out[task.title] ? `${out[task.title]}|${at}` : at;
  }
  return out;
}

/** The plan once two reads 500 ms apart agree. */
async function settled(page: Page): Promise<Record<string, string>> {
  let last = '';
  let now: Record<string, string> = {};
  await expect
    .poll(
      async () => {
        now = await where(page);
        const same = JSON.stringify(now) === last;
        last = JSON.stringify(now);
        return same;
      },
      { intervals: [500], timeout: 20_000 },
    )
    .toBe(true);
  return now;
}

/** Titles that are open twice or more. */
async function duplicates(page: Page): Promise<number> {
  const tasks = (await rows<Task>(page, 'todos_task')).filter((x) => !x.done);
  const seen = new Map<string, number>();
  for (const x of tasks) seen.set(x.title, (seen.get(x.title) ?? 0) + 1);
  return [...seen.values()].filter((n) => n > 1).reduce((s, n) => s + n - 1, 0);
}

/** Things of the weekend that are neither open nor done any more. */
async function lost(page: Page): Promise<number> {
  const tasks = await rows<Task>(page, 'todos_task');
  return ALL.filter((title) => !tasks.some((x) => x.title === title)).length;
}

/** Things whose place changed although no action named them (`moved` = the ones an action named). */
const unasked = (
  before: Record<string, string>,
  after: Record<string, string>,
  moved: readonly string[],
) => Object.keys(before).filter((k) => !moved.includes(k) && before[k] !== after[k]).length;

class Hand {
  taps = 0;
  perThing = 0;
  constructor(private page: Page) {}
  async tap(target: Locator, oneThing = false) {
    this.taps += 1;
    if (oneThing) this.perThing += 1;
    await target.click();
  }
  /** A paste or a typed line: one handle. */
  async fill(target: Locator, text: string) {
    this.taps += 1;
    await target.fill(text);
  }
}

/**
 * The selection box of a thing's row. Its name is „„Titel“ auswählen“ where the row names it, else the generic
 * „Auswählen“ (the planner's title is a button – K08): found through its row.
 */
const checkOf = (sheet: Locator, title: string) =>
  sheet
    .getByRole('checkbox', { name: `„${title}“ auswählen` })
    .or(
      sheet
        .locator('li')
        .filter({
          has: sheet.page().getByRole('button', { name: `Aktionen für ${title}`, exact: true }),
        })
        .getByRole('checkbox'),
    )
    .first();

/** Thing rows on the sheet of `date`. */
async function visibleOn(page: Page, date: string): Promise<number> {
  const sheet = page.getByTestId(`day-${date}`);
  await expect(sheet).toBeVisible();
  return sheet.getByRole('button', { name: /^Aktionen für / }).count();
}

/** One thing named as the place to start, above the day's list (`start-point`), after shrinking. */
const startPoint = async (page: Page) =>
  (await page.getByTestId('start-point').count()) > 0 ? 'ja' : 'nein';

/** The planner on today, the tab „Plan“. */
async function planner(page: Page) {
  await page.goto('/planner');
  await expect(page.locator('main h1')).toBeVisible();
}

/**
 * „Tag neu ab jetzt“ when the planner offers it (package „Nur das hier heute“): tick what stays, send the rest in one
 * move. Returns false when there is no such control (then the old path is measured).
 */
async function keepOnly(
  hand: Hand,
  page: Page,
  keep: readonly string[],
  rest: 'next' | 'week' | 'later',
  date: string,
): Promise<boolean> {
  const sheet = page.getByTestId(`day-${date}`);
  const start = page.getByRole('button', { name: 'Nur das hier', exact: true });
  const menu = page.getByRole('button', { name: 'Weitere Optionen', exact: true }).first();
  await hand.tap(menu);
  if (!(await page.getByRole('menuitem', { name: 'Nur das hier …' }).count())) {
    hand.taps -= 1;
    await page.keyboard.press('Escape');
    return false;
  }
  await hand.tap(page.getByRole('menuitem', { name: 'Nur das hier …' }));
  for (const title of keep) await hand.tap(checkOf(sheet, title));
  await hand.tap(start);
  const dialog = page.getByRole('dialog', { name: /^Der Rest/ });
  const label = { next: /^Morgen/, week: /^Diese Woche/, later: /^Nächste Wochen/ }[rest];
  await hand.tap(dialog.getByRole('button', { name: label }));
  await expect(dialog).toHaveCount(0);
  return true;
}

/** The old path: the day's „Auswählen“ · „Alle“ · untick what stays · „Auf einen Tag …“ · the day. */
async function moveRestOld(
  hand: Hand,
  page: Page,
  keep: readonly string[],
  date: string,
  to: string,
) {
  const sheet = page.getByTestId(`day-${date}`);
  await hand.tap(page.getByRole('button', { name: 'Weitere Optionen', exact: true }).first());
  await hand.tap(page.getByRole('menuitem', { name: 'Auswählen' }));
  await hand.tap(page.getByTestId('day-select').getByRole('button', { name: /^Alle von / }));
  for (const title of keep) await hand.tap(checkOf(sheet, title), true);
  await hand.tap(page.getByRole('button', { name: 'Auf einen Tag …' }));
  const dialog = page.getByRole('dialog', { name: /^Verschieben: \d+ Dinge?$/ });
  await hand.tap(dialog.getByRole('button', { name: chipLabel(to), exact: true }));
  await expect(dialog).toHaveCount(0);
}

/** One thing to „Irgendwann“ in the ToDos board (the planner has no such step): ⋯ · „Verschieben nach Irgendwann“. */
async function laterInTodos(hand: Hand, page: Page, titles: readonly string[]) {
  await hand.tap(
    page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'ToDos' })
      .first(),
  );
  await expect(page.locator('main h1')).toBeVisible();
  await hand.tap(
    page
      .getByRole('tab', { name: 'Board' })
      .or(page.getByRole('button', { name: 'Board', exact: true }))
      .first(),
  );
  for (const title of titles) {
    const card = page
      .locator('li')
      .filter({ has: page.getByRole('button', { name: title, exact: true }) })
      .first();
    await hand.tap(card.getByRole('button', { name: 'Weitere Optionen' }), true);
    await hand.tap(page.getByRole('menuitem', { name: 'Verschieben nach Irgendwann' }), true);
  }
  // The board writes after the menu closes: wait until every one is stored as „Irgendwann“.
  await expect
    .poll(async () => (await rows<Task>(page, 'todos_task')).filter((x) => x.someday).length)
    .toBe(titles.length);
}

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function chipLabel(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return `${WD[d.getDay()]} ${d.getDate()}.`;
}

function record(info: TestInfo, name: string, figures: Figures, facts: unknown) {
  mkdirSync(OUT, { recursive: true });
  const key = `${name.slice(0, 2)}-${info.project.name}`;
  writeFileSync(`${OUT}/${key}.json`, JSON.stringify({ name, figures }));
  writeFileSync(`${OUT}/${key}-facts.json`, JSON.stringify(facts, null, 1));
  const lines = readdirSync(OUT)
    .filter((f) => /^T\d-.+\.json$/.test(f) && !f.endsWith('-facts.json'))
    .sort()
    .flatMap((f) => {
      const row = JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')) as {
        name: string;
        figures: Figures;
      };
      const proj = f.slice(3, -'.json'.length);
      return Object.entries(row.figures).map(
        ([k, v]) =>
          `| ${row.name} | ${proj} | ${k} | ${v} | ${IST[row.name]?.[k] ?? '–'} | ${TARGET[row.name]?.[k] ?? '–'} |`,
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
  console.log(name, JSON.stringify(figures));
  if (process.env.MEASURE !== '1') reached(name, figures);
}

/**
 * A count may not grow beyond the better of its `IST` and its `TARGET` – but the target only binds once it is
 * reached (a build PR moves `IST` there); a word equals its `IST`, or its `TARGET` once `IST` says so.
 */
function reached(name: string, figures: Figures) {
  const ist = IST[name] ?? {};
  const target = TARGET[name] ?? {};
  for (const k of Object.keys(ist)) {
    const was = ist[k];
    const want = target[k];
    const got = figures[k];
    if (typeof was === 'string') expect(got, `${name}: ${k}`).toBe(was);
    else {
      const bound = typeof want === 'number' && typeof was === 'number' && was <= want ? want : was;
      expect(got, `${name}: ${k} ≤ ${bound}`).toBeLessThanOrEqual(bound as number);
    }
  }
}

test.skip(
  ({ isMobile }) => isMobile,
  'measured on the desktop; the phone path is the same controls',
);

test.beforeEach(() => {
  test.setTimeout(240_000);
});

test('T1 Samstag 16:00 – ab jetzt neu', async ({ page }, info) => {
  await prepare(page, `${SA}T16:00:00`);
  await planner(page);
  const before = await settled(page);
  const hand = new Hand(page);
  const keep = ['Pfand wegbringen', 'Wäsche waschen', 'Küche aufräumen', 'Flur saugen'];
  const rest = SATURDAY.filter((x) => !keep.includes(x));
  // „Pfand wegbringen“ only in part today: is there a step that makes one thing smaller in one move?
  const smaller = await page
    .getByRole('button', { name: 'Aktionen für Pfand wegbringen', exact: true })
    .first()
    .click()
    .then(() => page.getByRole('menuitem', { name: 'Kleiner machen …' }).count());
  await page.keyboard.press('Escape');
  if (!(await keepOnly(hand, page, keep, 'next', SA))) await moveRestOld(hand, page, keep, SA, SO);
  const after = await settled(page);
  const visibleToday = await visibleOn(page, SA);
  record(
    info,
    'T1 Samstag 16:00 – ab jetzt neu',
    {
      taps: hand.taps,
      perThing: hand.perThing,
      visibleToday,
      startPoint: await startPoint(page),
      smallerInOneMove: smaller > 0 ? 'ja' : 'nein',
      lost: await lost(page),
      unasked: unasked(before, after, rest),
    },
    { before, after },
  );
  for (const title of rest) expect(after[title]).toBe(SO);
});

test('T2 Samstagabend – 5 / 6 / 9', async ({ page }, info) => {
  await prepare(page, `${SA}T20:00:00`);
  await planner(page);
  const before = await settled(page);
  const hand = new Hand(page);
  // Saturday: five stay; „Einkaufsliste schreiben“ and „Paket abholen“ go to Sunday, the rest to the next weeks.
  const saLater = SATURDAY.filter((x) => !KEEP_SA.includes(x) && !KEEP_SO.includes(x));
  const soLater = SUNDAY.filter((x) => !KEEP_SO.includes(x));
  const toSunday = SATURDAY.filter((x) => KEEP_SO.includes(x));
  let laterInPlanner = 'nein';
  // Saturday first: what stays, then what goes to Sunday, then the rest.
  if (await keepOnly(hand, page, [...KEEP_SA, ...toSunday], 'later', SA)) {
    laterInPlanner = 'ja';
    // The two for Sunday: „Auswählen“ on the sheet, one day for both.
    await moveRestOld(hand, page, KEEP_SA, SA, SO);
    await hand.tap(page.getByTestId(`week-${SO}`));
    await keepOnly(hand, page, KEEP_SO, 'later', SO);
  } else {
    await moveRestOld(hand, page, KEEP_SA, SA, SO);
    await laterInTodos(hand, page, [...saLater, ...soLater]);
    await planner(page);
    hand.taps += 1;
  }
  const after = await settled(page);
  const visibleToday = await visibleOn(page, SA);
  record(
    info,
    'T2 Samstagabend – 5 / 6 / 9',
    {
      taps: hand.taps,
      perThing: hand.perThing,
      laterInPlanner,
      visibleToday,
      startPoint: await startPoint(page),
      lost: await lost(page),
      unasked: unasked(before, after, [...saLater, ...soLater, ...toSunday]),
    },
    { before, after },
  );
  for (const title of LATER) expect(after[title], title).toBe('später');
  for (const title of KEEP_SA) expect(after[title], title).toBe(SA);
  for (const title of KEEP_SO) expect(after[title], title).toBe(SO);
});

test('T3 Montag – letzter Stand, neu legen', async ({ page }, info) => {
  // The weekend after step 2 (state written directly): five on Saturday, six on Sunday, nine for later; two done.
  await prepare(page, `${MO}T08:00:00`);
  await page.evaluate(
    ({ later, done }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['todos_task', 'planner_assignment'], 'readwrite');
          const tasks = tx.objectStore('todos_task');
          const all = tasks.getAll();
          all.onsuccess = () => {
            for (const x of all.result as { id: string; title: string }[]) {
              if (later.includes(x.title)) {
                tasks.put({ ...x, someday: true, plannedFor: undefined, planMark: undefined });
                tx.objectStore('planner_assignment').delete(`todos:${x.id}#0`);
              }
              if (done.includes(x.title)) tasks.put({ ...x, done: true, completedAt: 1 });
            }
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { later: LATER, done: ['Wäsche waschen', 'Pflanzen gießen', 'Bad putzen'] },
  );
  await planner(page);
  const hand = new Hand(page);
  await hand.tap(page.getByRole('navigation', { name: 'Ansicht' }).getByText(/^Noch offen/));
  const tab = page.getByTestId('planner-open');
  await expect(tab).toBeVisible();
  // The last state is there, calmly: no figure on the tab or in its lines.
  const tabText =
    (await page.getByRole('navigation', { name: 'Ansicht' }).innerText()) + (await tab.innerText());
  const countsShown = (tabText.match(/\b\d+ (offen|Dinge|verpasst)\b/g) ?? []).length;
  await hand.tap(tab.getByRole('button', { name: 'Alle auf heute' }));
  await expect(page.getByTestId('planner-open'))
    .toHaveCount(0, { timeout: 10_000 })
    .catch(() => undefined);
  await planner(page);
  const visibleToday = await visibleOn(page, MO);
  record(
    info,
    'T3 Montag – letzter Stand, neu legen',
    { taps: hand.taps, perThing: hand.perThing, countsShown, visibleToday, lost: await lost(page) },
    { tabText },
  );
});

/** The plan of step 2 as the ToDos' JSON (`plannedFor`, `someday`) – what a chat outside hands back. */
const planJson = (swap = false) =>
  JSON.stringify({
    items: [
      ...days(swap).sa.map((title) => ({
        collection: 'task',
        title,
        plannedFor: SA,
        estimateMin: 30,
      })),
      ...days(swap).so.map((title) => ({
        collection: 'task',
        title,
        plannedFor: SO,
        estimateMin: 30,
      })),
      ...LATER.map((title) => ({ collection: 'task', title, someday: true })),
    ],
  });

/** The chat's second split: „Flur saugen“ to Sunday, „Paket abholen“ to Saturday. */
const days = (swap: boolean) =>
  swap
    ? {
        sa: [...KEEP_SA.filter((x) => x !== 'Flur saugen'), 'Paket abholen'],
        so: [...KEEP_SO.filter((x) => x !== 'Paket abholen'), 'Flur saugen'],
      }
    : { sa: KEEP_SA, so: KEEP_SO };

/** The same plan as text from a chat: day headings, bullets, a section for later. */
const planText = (swap = false) =>
  [
    'Ziel fürs Wochenende: Wohnung frei bekommen',
    '',
    'Samstag',
    ...days(swap).sa.map((x, i) => `- ${x}${i === 0 ? ' (15 Minuten)' : ''}`),
    '',
    'So 29.11.',
    ...days(swap).so.map((x, i) => `- ${x}${i === 0 ? ' 20–30 Min' : ''}`),
    '',
    'Nächste Wochen – nicht gestrichen',
    ...LATER.map((x) => `- ${x}`),
  ].join('\n');

/**
 * „Plan einfügen“, when the planner has it: a block pasted into the planner's field opens the preview by itself – tap
 * the field, paste, „Übernehmen“ (three handles). False when the paste stays a line (then the old path is measured).
 */
async function pastePlan(hand: Hand, page: Page, text: string): Promise<boolean> {
  const field = page.locator('main form input[type="text"], main form input:not([type])').first();
  await hand.tap(field);
  hand.taps += 1;
  await field.evaluate((el, text) => {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, text);
  const dialog = page.getByRole('dialog', { name: 'Plan einfügen' });
  const opened = await dialog
    .waitFor({ state: 'visible', timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    hand.taps -= 2;
    await field.fill('');
    return false;
  }
  const apply = dialog.getByRole('button', { name: 'Übernehmen', exact: true });
  await expect(apply).toBeEnabled();
  await hand.tap(apply);
  await expect(dialog).toHaveCount(0);
  return true;
}

/** The old path: ToDos ⋯ · Importieren · JSON einfügen · paste · Vorschau · import · close, then each day's „Hierher legen“. */
async function importOld(hand: Hand, page: Page, json: string) {
  await page.goto('/todos');
  await expect(page.locator('main h1')).toBeVisible();
  hand.taps += 1;
  await hand.tap(page.getByRole('button', { name: 'Weitere Optionen', exact: true }));
  await hand.tap(page.getByRole('menuitem', { name: 'Importieren' }));
  const dialog = page.getByRole('dialog', { name: /Importieren/ });
  await hand.tap(dialog.getByRole('button', { name: /JSON einfügen/ }));
  await hand.fill(dialog.getByLabel('JSON', { exact: true }), json);
  await hand.tap(dialog.getByRole('button', { name: 'Vorschau anzeigen' }));
  // Everything „Schon vorhanden“: nothing to import, the button stays off – the plan is not taken over.
  const go = dialog.getByRole('button', { name: /importieren$/ });
  await expect(go).toBeVisible();
  if (await go.isEnabled()) {
    await hand.tap(go);
    await expect(dialog.getByRole('status')).toBeVisible();
  }
  await hand.tap(dialog.getByRole('button', { name: 'Schließen' }).last());
  await planner(page);
  hand.taps += 1;
  for (const date of [SA, SO]) {
    if (date !== SA) await hand.tap(page.getByTestId(`week-${date}`));
    const place = page.getByTestId(`day-${date}`).getByRole('button', { name: /^Hierher legen: / });
    for (let guard = 0; guard < 30 && (await place.count()); guard++) {
      hand.taps += 1;
      hand.perThing += 1;
      // The muted row re-renders while the plan settles: a click that finds it detached is tried again.
      await place
        .first()
        .click({ timeout: 10_000 })
        .catch(() => {
          hand.taps -= 1;
          hand.perThing -= 1;
        });
      await page.waitForTimeout(300);
    }
  }
}

test('T4 Plan von außen übernehmen', async ({ page }, info) => {
  await prepare(page, `${SA}T20:00:00`);
  await planner(page);
  const before = await settled(page);
  const hand = new Hand(page);
  let textPossible = 'nein';
  if (await pastePlan(hand, page, planText())) textPossible = 'ja';
  else await importOld(hand, page, planJson());
  const after = await settled(page);
  const onTheirDay =
    KEEP_SA.filter((x) => after[x]?.split('|').includes(SA)).length +
    KEEP_SO.filter((x) => after[x]?.split('|').includes(SO)).length;
  const first = await duplicates(page);
  // The chat splits again: the same plan, two things swapped between the days. Pasted again.
  await planner(page);
  const again = new Hand(page);
  // The second time as the ToDos' JSON: both formats, one recognition.
  if (textPossible === 'ja') await pastePlan(again, page, planJson(true));
  else await importOld(again, page, planJson(true));
  const second = await settled(page);
  // The swap reached the plan: „Flur saugen“ on Sunday, „Paket abholen“ on Saturday (once each).
  const swapped = second['Flur saugen'] === SO && second['Paket abholen'] === SA ? 'ja' : 'nein';
  record(
    info,
    'T4 Plan von außen übernehmen',
    {
      taps: hand.taps,
      perThing: hand.perThing,
      textPossible,
      onTheirDay,
      duplicates: first,
      secondDuplicates: await duplicates(page),
      swapped,
      lost: await lost(page),
    },
    { before, after, second },
  );
});
