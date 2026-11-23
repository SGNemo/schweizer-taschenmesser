/**
 * „Plan einfügen“ (docs/design/usecases/tag-kippt/TARGET.md §3): reading text and JSON locally, recognising what the
 * plan already holds, and „Übernehmen“ as one undoable action that doubles nothing and loses nothing.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { enableModule } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { resetUndoJournal, undoDepth, undoLast } from '@/core/undo';
import { useUiStore } from '@/stores/ui';
import { applyPaste, pasteKnown, setGoal } from '../actions';
import { copyInput } from '../copyPlan';
import manifest from '../manifest';
import {
  goalDays,
  looksLikePlan,
  planAsText,
  matchPaste,
  readPastedPlan,
  sameTitle,
  type Known,
} from '../pastePlan';
import { assignmentRepo, dayRepo } from '../repo';
import { runsSettled, setManifestsForTests } from '../services';

const SA = '2026-11-28';
const SO = '2026-11-29';
const MO = '2026-11-30';

describe('readPastedPlan – text', () => {
  const text = [
    'Hier ist dein neuer Plan.',
    'Ziel fürs Wochenende: Wohnung frei bekommen',
    '',
    '**Samstag**',
    '- Pfand sammeln (15 Minuten)',
    '- Wäsche waschen',
    '',
    '## So 29.11.',
    '* Bad putzen 20–30 Min',
    '1. Mail an Kollegin',
    '',
    'Im Laufe der Woche:',
    '• Pfand wegbringen',
    '',
    'Nächste Wochen – nicht gestrichen',
    '- [ ] Steuerordner sortieren',
    '- [x] Schon erledigt',
  ].join('\n');

  it('reads day headings, sections for later and this week, bullets and efforts', () => {
    const plan = readPastedPlan(text, SA);
    expect(plan.format).toBe('text');
    expect(plan.things).toEqual([
      { title: 'Pfand sammeln', when: { kind: 'day', date: SA }, minutes: 15 },
      { title: 'Wäsche waschen', when: { kind: 'day', date: SA } },
      { title: 'Bad putzen', when: { kind: 'day', date: SO }, minutes: 30 },
      { title: 'Mail an Kollegin', when: { kind: 'day', date: SO } },
      { title: 'Pfand wegbringen', when: { kind: 'week' } },
      { title: 'Steuerordner sortieren', when: { kind: 'later' } },
    ]);
    // The chat's sentence is no thing; the goal line and the ticked line are left out quietly.
    expect(plan.skipped).toBe(1);
  });

  it('resolves heute, morgen, weekday names (today or the next one) and dates', () => {
    const at = (h: string) => readPastedPlan(`${h}\n- x`, SA).things[0]!.when;
    expect(at('Heute')).toEqual({ kind: 'day', date: SA });
    expect(at('Morgen:')).toEqual({ kind: 'day', date: SO });
    expect(at('Montag')).toEqual({ kind: 'day', date: MO });
    expect(at('Sa')).toEqual({ kind: 'day', date: SA });
    expect(at('Fr 27.11.')).toEqual({ kind: 'day', date: '2026-11-27' });
    expect(at('2026-12-02')).toEqual({ kind: 'day', date: '2026-12-02' });
    // Early January read in late December is next year.
    expect(readPastedPlan('3.1.\n- x', '2026-12-30').things[0]!.when).toEqual({
      kind: 'day',
      date: '2027-01-03',
    });
    expect(at('Später')).toEqual({ kind: 'later' });
    expect(at('Verschoben:')).toEqual({ kind: 'later' });
    expect(at('Diese Woche')).toEqual({ kind: 'week' });
  });

  it('keeps a long bullet with a day word as a thing, and a thing once', () => {
    const plan = readPastedPlan(
      'Samstag\n- Morgen früh Brötchen holen\n- Brötchen  holen!\n- brötchen holen',
      SA,
    );
    expect(plan.things.map((x) => x.title)).toEqual([
      'Morgen früh Brötchen holen',
      'Brötchen holen!',
    ]);
  });

  it('a plain list without headings has no day', () => {
    expect(readPastedPlan('Wäsche\nKüche', SA).things.every((x) => x.when.kind === 'none')).toBe(
      true,
    );
  });
});

describe('readPastedPlan – council round 1', () => {
  it('a day written as a marked list item is a heading; an unmarked line with „später“ is a thing', () => {
    const plan = readPastedPlan(
      '- **Samstag:**\n  - Wäsche\n1. Montag:\n  - Bad\nOma später anrufen\nDanach einkaufen',
      SA,
    );
    expect(plan.things.map((x) => [x.title, x.when])).toEqual([
      ['Wäsche', { kind: 'day', date: SA }],
      ['Bad', { kind: 'day', date: MO }],
      ['Oma später anrufen', { kind: 'day', date: MO }],
      ['Danach einkaufen', { kind: 'day', date: MO }],
    ]);
  });

  it('yesterday by name is yesterday (the preview asks); an impossible date is no heading', () => {
    expect(readPastedPlan('Samstag\n- x', SO).things[0]!.when).toEqual({ kind: 'day', date: SA });
    expect(readPastedPlan('31.11.:\n- x', SA).things.map((x) => x.when)).toEqual([
      { kind: 'none' },
    ]);
  });

  it('a ticked box without a bullet stays out; a closing sentence with an emoji is prose', () => {
    const plan = readPastedPlan('Samstag\n[x] erledigt\n- Wäsche\nViel Erfolg! 💪', SA);
    expect(plan.things.map((x) => x.title)).toEqual(['Wäsche']);
    expect(plan.skipped).toBe(1);
  });

  it('a very long line of digits is read at once (no runaway pattern)', () => {
    const started = performance.now();
    readPastedPlan(`Samstag\n- ${'1'.repeat(5000)}\n- ${'1 '.repeat(3000)}`, SA);
    expect(performance.now() - started).toBeLessThan(200);
  });

  it("weekday headings go on from the paste's earlier days (a week plan pasted mid-week)", () => {
    const wed = '2026-11-25';
    const plan = readPastedPlan('Mittwoch\n- a\nDienstag\n- b\nMontag\n- c', wed);
    expect(plan.things.map((x) => x.when)).toEqual([
      { kind: 'day', date: wed },
      { kind: 'day', date: '2026-12-01' },
      { kind: 'day', date: '2026-12-07' },
    ]);
  });

  it('subtasks of the ToDos JSON stay out', () => {
    const plan = readPastedPlan(
      JSON.stringify({ items: [{ title: 'A' }, { title: 'A1', parentId: 'x' }] }),
      SA,
    );
    expect(plan.things.map((x) => x.title)).toEqual(['A']);
    expect(plan.skipped).toBe(1);
  });
});

describe('readPastedPlan – JSON', () => {
  it('reads the ToDos format: plannedFor, someday, estimateMin; other collections and done ones stay out', () => {
    const json = JSON.stringify({
      items: [
        { collection: 'task', title: 'Wäsche waschen', plannedFor: SA, estimateMin: 45 },
        { collection: 'task', title: 'Steuerordner sortieren', someday: true },
        { collection: 'task', title: 'Ohne Tag' },
        { collection: 'list', name: 'Haushalt' },
        { collection: 'task', title: 'Erledigt', done: true },
        { title: 'Kaputtes Datum', plannedFor: '28.11.' },
      ],
    });
    const plan = readPastedPlan(json, SA);
    expect(plan.format).toBe('json');
    expect(plan.things).toEqual([
      { title: 'Wäsche waschen', when: { kind: 'day', date: SA }, minutes: 45 },
      { title: 'Steuerordner sortieren', when: { kind: 'later' } },
      { title: 'Ohne Tag', when: { kind: 'none' } },
      { title: 'Kaputtes Datum', when: { kind: 'none' } },
    ]);
    expect(plan.skipped).toBe(2);
  });

  it('looksLikePlan: a block or JSON with things, never one line', () => {
    expect(looksLikePlan('Wäsche waschen morgen')).toBe(false);
    expect(looksLikePlan('Samstag\n- Wäsche')).toBe(true);
    expect(looksLikePlan('{"items":[{"title":"A","plannedFor":"2026-11-28"}]}')).toBe(true);
    expect(looksLikePlan('{"note":"nothing"}')).toBe(false);
  });
});

describe('matchPaste', () => {
  const known: Known[] = [
    { key: 'todos:a', title: 'Wäsche waschen', place: { kind: 'day', date: SA }, canLater: true },
    { key: 'todos:b', title: '„Bad putzen“', place: { kind: 'day', date: SA }, canLater: true },
    { key: 'todos:c', title: 'Steuerordner sortieren', place: { kind: 'later' }, canLater: true },
    { key: 'todos:d', title: 'Flur saugen', place: { kind: 'day', date: SO }, canLater: true },
    {
      key: 'invoices:e',
      title: 'Rechnung zahlen',
      place: { kind: 'day', date: SA },
      canLater: false,
    },
  ];

  it('the same title is the same thing: stays, moves, or comes back from later; new things are new', () => {
    const plan = readPastedPlan(
      'Samstag\n- wäsche waschen\n- Neu kaufen\nSonntag\n- Bad putzen.\n- Steuerordner sortieren\nSpäter\n- Rechnung zahlen',
      SA,
    );
    const { lines, missing } = matchPaste(plan, known, SA, 'none');
    expect(lines.map((l) => [l.id, l.change, l.to])).toEqual([
      ['todos:a', 'same', { kind: 'day', date: SA }],
      ['new:neu kaufen', 'new', { kind: 'day', date: SA }],
      ['todos:b', 'move', { kind: 'day', date: SO }],
      ['todos:c', 'move', { kind: 'day', date: SO }],
      // A source that keeps nothing for later: no day instead.
      ['invoices:e', 'move', { kind: 'week' }],
    ]);
    // Laid between today and the paste's last day, not named: listed, left alone.
    expect(missing.map((k) => k.key)).toEqual(['todos:d']);
  });

  it('a passed day asks once: no day by default, today on request', () => {
    const plan = readPastedPlan('Fr 27.11.\n- Wäsche waschen', SA);
    expect(matchPaste(plan, known, SA, 'none')).toMatchObject({
      hasPast: true,
      lines: [{ to: { kind: 'week' }, past: true }],
    });
    expect(matchPaste(plan, known, SA, 'today').lines[0]!.to).toEqual({ kind: 'day', date: SA });
  });

  it('a thing its source dates keeps its day; a „fest“ thing is marked; new lines are keyed by title', () => {
    const dated: Known[] = [
      {
        key: 'fitness:t',
        title: 'Training',
        place: { kind: 'day', date: SA },
        canLater: false,
        dated: true,
      },
    ];
    const { lines } = matchPaste(
      readPastedPlan('Später\n- Training\n- Neu', SA),
      dated,
      SA,
      'none',
    );
    expect(lines.map((l) => [l.id, l.change, l.to])).toEqual([
      ['fitness:t', 'same', { kind: 'day', date: SA }],
      ['new:neu', 'new', { kind: 'later' }],
    ]);
  });

  it('a timed block is known (never made twice) and never moved; a „fest“ missing thing is marked', () => {
    const k: Known[] = [
      {
        key: 'calendar:x',
        title: 'Geburtstag Oma',
        place: { kind: 'day', date: SA },
        canLater: false,
        fixed: true,
      },
      {
        key: 'todos:f',
        title: 'Zahnarzt',
        place: { kind: 'day', date: SA },
        canLater: true,
        locked: true,
      },
    ];
    const { lines, missing } = matchPaste(
      readPastedPlan('Sonntag\n- 14:00 Geburtstag Oma', SA),
      k,
      SA,
      'none',
    );
    expect(lines.map((l) => [l.id, l.change])).toEqual([['calendar:x', 'same']]);
    expect(missing.map((m) => [m.key, m.locked])).toEqual([['todos:f', true]]);
  });

  it('sameTitle ignores case, spaces, quotes and trailing marks', () => {
    expect(sameTitle(' „Bad  Putzen“! ')).toBe(sameTitle('bad putzen'));
  });
});

describe('planAsText (P3)', () => {
  const words = {
    goal: (g: string) => `Ziel: ${g}`,
    day: (d: string) =>
      `${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${d}T12:00:00`).getDay()]} ${Number(d.slice(8))}.${Number(d.slice(5, 7))}.`,
    week: 'Diese Woche, ohne Tag',
    later: 'Nächste Wochen',
    minutes: (m: number) => `${m} Min`,
    fixed: (title: string, from: string, to: string) => `(${from}–${to} ${title})`,
  };
  const plan = {
    goal: 'Wohnung frei bekommen',
    days: [
      {
        date: SA,
        things: [
          { title: 'Wäsche waschen', minutes: 30 },
          { title: 'Pfand sammeln', minutes: 15 },
        ],
      },
      { date: SO, things: [{ title: 'Bad putzen' }] },
      { date: MO, things: [] },
    ],
    week: [{ title: 'Pfand wegbringen', minutes: 20 }],
    later: [{ title: 'Steuerordner sortieren' }],
  };

  it('reads back as the same plan: every thing on its place, efforts and goal kept', () => {
    const text = planAsText(plan, words);
    const back = readPastedPlan(text, SA);
    expect(back.goal).toBe('Wohnung frei bekommen');
    expect(back.things).toEqual([
      { title: 'Wäsche waschen', when: { kind: 'day', date: SA }, minutes: 30 },
      { title: 'Pfand sammeln', when: { kind: 'day', date: SA }, minutes: 15 },
      { title: 'Bad putzen', when: { kind: 'day', date: SO } },
      { title: 'Pfand wegbringen', when: { kind: 'week' }, minutes: 20 },
      { title: 'Steuerordner sortieren', when: { kind: 'later' } },
    ]);
  });

  it('holds titles, days, minutes and the goal only – nothing else of the plan', () => {
    const text = planAsText(plan, words);
    expect(text).toBe(
      [
        'Ziel: Wohnung frei bekommen',
        '',
        'Sa 28.11.:',
        '- Wäsche waschen (30 Min)',
        '- Pfand sammeln (15 Min)',
        '',
        'So 29.11.:',
        '- Bad putzen',
        '',
        'Diese Woche, ohne Tag:',
        '- Pfand wegbringen (20 Min)',
        '',
        'Nächste Wochen:',
        '- Steuerordner sortieren',
      ].join('\n'),
    );
    expect(planAsText({ days: [], week: [], later: [] }, words)).toBe('');
  });
});

describe('copyInput + planAsText (P3, council round 1)', () => {
  const de = {
    goal: (g: string) => `Ziel: ${g}`,
    day: (d: string) =>
      `${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${d}T12:00:00`).getDay()]} ${Number(d.slice(8))}.${Number(d.slice(5, 7))}.`,
    week: 'Diese Woche, ohne Tag',
    later: 'Nächste Wochen',
    minutes: (m: number) => `${m} Min`,
    fixed: (title: string, from: string, to: string) => `(${from}–${to} ${title})`,
  };
  const en = {
    ...de,
    goal: (g: string) => `Goal: ${g}`,
    day: (d: string) =>
      `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${d}T12:00:00`).getDay()]} ${Number(d.slice(8))}.${Number(d.slice(5, 7))}.`,
    week: 'This week, no day yet',
    later: 'Next weeks',
  };
  const entry = {} as never;
  const row = (itemKey: string, title: string, minutes: number, extra = {}) =>
    ({ itemKey, title, minutes, approx: false, entry, ...extra }) as never;

  it('titles the reader would change are quoted and read back as they are; blocks are remarks', () => {
    const tricky = ['30 Min joggen', '10:00 Ärztin anrufen', 'Später:', 'Ziel: Ruhe', 'Wäsche'];
    const input = copyInput(
      [
        {
          date: SA,
          rows: [
            ...tricky.map((x, i) => row(`todos:${i}`, x, 20)),
            row('fitness:t', 'Training', 90, { fixed: { from: '18:00', to: '19:30' } }),
          ],
        },
      ],
      [],
      [],
      { from: SA, to: SO },
    );
    for (const words of [de, en]) {
      const text = planAsText(input, words);
      expect(text).toContain('(18:00–19:30 Training)');
      const back = readPastedPlan(text, SA);
      expect(back.goal).toBeUndefined();
      expect(back.things.map((x) => [x.title, x.when, x.minutes])).toEqual(
        tricky.map((x) => [x, { kind: 'day', date: SA }, 20]),
      );
    }
  });

  it("round 2: a chat's other quotes are read literally, a bulleted remark is no thing, a goal that would change stays out", () => {
    const back = readPastedPlan(
      'Samstag:\n- “30 Min joggen” (20 Min)\n- "Ziel: Ruhe"\n- «Später:»\n- (18:00–19:30 Training)',
      SA,
    );
    expect(back.goal).toBeUndefined();
    expect(back.things.map((x) => [x.title, x.minutes])).toEqual([
      ['30 Min joggen', 20],
      ['Ziel: Ruhe', undefined],
      ['Später:', undefined],
    ]);
    // A quote that is only part of the title keeps the whole title; a bracket without a time stays a thing.
    expect(
      readPastedPlan('Samstag:\n- "Faust" lesen (30 Min)\n- (Wäsche, falls Zeit)', SA).things.map(
        (x) => [x.title, x.minutes],
      ),
    ).toEqual([
      ['"Faust" lesen', 30],
      ['(Wäsche, falls Zeit)', undefined],
    ]);
    const days = [{ date: SA, things: [{ title: 'Wäsche' }] }];
    for (const goal of ['Mail_an_Chef', '**Ruhe**'])
      expect(planAsText({ goal, days, week: [], later: [] }, de)).not.toContain('Ziel:');
    expect(planAsText({ goal: 'Wohnung frei', days, week: [], later: [] }, de)).toContain(
      'Ziel: Wohnung frei',
    );
  });

  it('a day with only fixed times does not count for the goal (goalDays names days with things)', () => {
    const out = copyInput(
      [
        {
          date: SA,
          rows: [row('todos:a', 'Wäsche', 30)],
          row: { date: SA, blockers: [], note: 'Ruhe' },
        },
        {
          date: SO,
          rows: [row('fitness:t', 'Training', 60, { fixed: { from: '10:00', to: '11:00' } })],
          row: { date: SO, blockers: [], note: 'Anderes' },
        },
      ] as never,
      [],
      [],
      { from: SA, to: SO },
    );
    expect(out.goal).toBe('Ruhe');
    expect(out.days[1]!.fixed).toEqual([{ title: 'Training', from: '10:00', to: '11:00' }]);
  });

  it('the goal goes only when every day with things has it; left-out and guessed things stay out', () => {
    const day = (date: string, note: string | undefined, ...rows: never[]) => ({
      date,
      rows,
      ...(note ? { row: { date, blockers: [], note } } : {}),
    });
    const weekend = [
      day(SA, 'Wohnung frei', row('todos:a', 'Wäsche', 30)),
      day(SO, 'Wohnung frei', row('todos:b', 'Bad', 30, { approx: true })),
    ];
    expect(copyInput(weekend, [], [], { from: SA, to: SO }).goal).toBe('Wohnung frei');
    const withMonday = [...weekend, day(MO, undefined, row('todos:c', 'Mail', 15))];
    expect(copyInput(withMonday, [], [], { from: SA, to: MO }).goal).toBeUndefined();
    const out = copyInput(
      weekend,
      [
        { itemKey: 'todos:x', title: 'Nicht im Plan', minutes: 30, reason: 'excluded', entry },
        { itemKey: 'todos:y', title: 'Ohne Tag', minutes: 30, reason: 'kept', entry },
      ] as never,
      [{ title: 'Später' }],
      { from: SA, to: SO },
    );
    expect(out.days[1]!.things).toEqual([{ title: 'Bad' }]);
    expect(out.week).toEqual([{ title: 'Ohne Tag' }]);
    expect(out.later).toEqual([{ title: 'Später' }]);
  });
});

describe('applyPaste', () => {
  const todos = getManifest('todos')!;
  const taskRepo = createCollectionRepo(todos, 'task');
  const at = (date: string) => new Date(`${date}T16:00:00`);
  const tasks = async () =>
    (await taskRepo.active().toArray()) as unknown as {
      id: string;
      title: string;
      done: boolean;
      someday?: boolean;
      plannedFor?: string;
    }[];
  const place = async () => {
    const rows = await assignmentRepo.active().toArray();
    return Object.fromEntries(
      (await tasks()).map((x) => [
        x.title,
        x.someday ? 'later' : (rows.find((r) => r.itemKey === `todos:${x.id}`)?.date ?? 'none'),
      ]),
    );
  };

  beforeEach(async () => {
    setNow(() => at(SA).getTime());
    for (const t of [
      'planner_day',
      'planner_item',
      'planner_assignment',
      'todos_task',
      'todos_list',
      '_settings',
      '_meta',
      '_modules',
    ])
      await db.table(t).clear();
    setManifestsForTests(async () => [todos]);
    await createCollectionRepo(todos, 'list').create(
      { name: 'Eingang', order: 0 },
      { id: 'inbox' },
    );
    await db.table('_modules').put({
      id: 'todos',
      enabled: true,
      dataPolicy: null,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 't',
      deletedAt: null,
      _f: {},
    });
    await enableModule(manifest);
    for (const [id, title, date] of [
      ['a', 'Wäsche waschen', SA],
      ['b', 'Bad putzen', SA],
      ['c', 'Flur saugen', SO],
      ['d', 'Pflanzen gießen', SO],
    ] as const) {
      await taskRepo.create(
        { listId: 'inbox', done: false, priority: 0, order: 0, title, estimateMin: 30 },
        { id },
      );
      await assignmentRepo.create(
        { itemKey: `todos:${id}`, k: 0, of: 1, date, minutes: 30, order: 0, reason: 'new' },
        { id: `todos:${id}#0` },
      );
    }
    resetUndoJournal();
    useUiStore.setState({ toasts: [] });
  });
  afterEach(async () => {
    await runsSettled();
    setNow();
    setManifestsForTests(undefined);
    resetUndoJournal();
  });

  const paste = async (text: string, missingLater = false) => {
    const preview = matchPaste(readPastedPlan(text, SA), await pasteKnown(), SA, 'none');
    const ok = await applyPaste(preview.lines, missingLater ? preview.missing : [], {});
    await runsSettled();
    return { ok, preview };
  };
  const PLAN =
    'Samstag\n- Wäsche waschen\n- Pfand sammeln 15 Min\nSonntag\n- Bad putzen\nNächste Wochen\n- Pflanzen gießen';

  it("P2: goalDays are the days the paste names – not a known thing's own day; a passed day only „Auf heute“", () => {
    const plan = readPastedPlan('Ziel: Ruhe\nFr 27.11.\n- a\nSonntag\n- b\nohne Überschrift', SA);
    expect(goalDays(plan, SA, 'none')).toEqual([SO]);
    expect(goalDays(plan, SA, 'today')).toEqual([SA, SO]);
    expect(goalDays(readPastedPlan('Ziel: Ruhe\n- a\n- b', SA), SA, 'none')).toEqual([SA]);
  });

  it('P2: the goal line goes onto the days the paste names, in the same undo; ✕ takes it off again', async () => {
    const text =
      'Ziel fürs Wochenende: Wohnung frei bekommen\nSamstag\n- Wäsche waschen\nSonntag\n- Bad putzen';
    const plan = readPastedPlan(text, SA);
    expect(plan.goal).toBe('Wohnung frei bekommen');
    expect(plan.things.map((x) => x.title)).toEqual(['Wäsche waschen', 'Bad putzen']);
    const preview = matchPaste(plan, await pasteKnown(), SA, 'none');
    await applyPaste(preview.lines, [], {}, { text: plan.goal!, dates: [SA, SO] });
    await runsSettled();
    expect(undoDepth()).toBe(1);
    expect((await dayRepo.get(SA))?.note).toBe('Wohnung frei bekommen');
    expect((await dayRepo.get(SO))?.note).toBe('Wohnung frei bekommen');
    await undoLast();
    await runsSettled();
    expect((await dayRepo.get(SA))?.note).toBeUndefined();
    // The same paste twice: the goal is there already – nothing written, no undo entry.
    await applyPaste(preview.lines, [], {}, { text: plan.goal!, dates: [SA, SO] });
    await runsSettled();
    const depth = undoDepth();
    const again = matchPaste(plan, await pasteKnown(), SA, 'none');
    expect(await applyPaste(again.lines, [], {}, { text: plan.goal!, dates: [SA, SO] })).toBe(
      false,
    );
    expect(undoDepth()).toBe(depth);
    await setGoal([SA, SO], 'Ruhig bleiben', {});
    await setGoal([SA, SO], undefined, {});
    await runsSettled();
    expect((await dayRepo.get(SO))?.note).toBeUndefined();
  });

  it('moves known things, makes new ones, sends later to „Irgendwann“ – one undo entry, the rest untouched', async () => {
    const before = await place();
    const { ok, preview } = await paste(PLAN);
    expect(ok).toBe(true);
    expect(undoDepth()).toBe(1);
    expect(preview.missing.map((k) => k.title)).toEqual(['Flur saugen']);
    expect(await place()).toEqual({
      'Wäsche waschen': SA,
      'Bad putzen': SO,
      'Flur saugen': SO,
      'Pflanzen gießen': 'later',
      'Pfand sammeln': SA,
    });
    expect((await tasks()).find((x) => x.title === 'Pfand sammeln')).toMatchObject({
      estimateMin: 15,
    });
    expect(useUiStore.getState().toasts.at(-1)?.message).toBe(
      'Plan übernommen – was für später ist, steht unter „Nächste Wochen“.',
    );
    // One undo brings the whole paste back: no new ToDo, every thing on its old place.
    expect(await undoLast()).toBeTruthy();
    await runsSettled();
    expect(await place()).toEqual(before);
  });

  it('pasting again doubles nothing; a thing for later comes back to its day; missing ones go only on request', async () => {
    await paste(PLAN);
    await paste(
      'Samstag\n- Bad putzen\n- Pfand sammeln\nSonntag\n- Wäsche waschen\n- Pflanzen gießen',
      true,
    );
    const all = await tasks();
    expect(all.length).toBe(5);
    expect(new Set(all.map((x) => x.title)).size).toBe(5);
    expect(await place()).toEqual({
      'Wäsche waschen': SO,
      'Bad putzen': SA,
      'Flur saugen': 'later',
      'Pflanzen gießen': SO,
      'Pfand sammeln': SA,
    });
  });

  it('a paste that changes nothing writes nothing and leaves no undo entry', async () => {
    await paste('Samstag\n- Wäsche waschen\n- Bad putzen');
    const n = undoDepth();
    const { preview } = await paste('Samstag\n- Wäsche waschen\n- Bad putzen');
    expect(preview.lines.every((l) => l.change === 'same')).toBe(true);
    expect(undoDepth()).toBe(n);
  });
});
