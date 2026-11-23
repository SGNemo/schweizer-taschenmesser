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
import { applyPaste, pasteKnown } from '../actions';
import manifest from '../manifest';
import { looksLikePlan, matchPaste, readPastedPlan, sameTitle, type Known } from '../pastePlan';
import { assignmentRepo } from '../repo';
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
      ['new:1', 'new', { kind: 'day', date: SA }],
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

  it('sameTitle ignores case, spaces, quotes and trailing marks', () => {
    expect(sameTitle(' „Bad  Putzen“! ')).toBe(sameTitle('bad putzen'));
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
    expect(useUiStore.getState().toasts.at(-1)?.message).toBe('Plan übernommen.');
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
