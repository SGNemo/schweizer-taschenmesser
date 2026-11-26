import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { bus } from '@/core/events';
import { getManifest } from '@/core/modules/registry';
import { calendarBlockers } from '@/core/plan/capacity';
import { setSettings } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { undoDepth, undoLast } from '@/core/undo';
import { useUiStore } from '@/stores/ui';
import { addFromField, addKindFromField, leadDay, type FieldLead } from '../actions';
import { assignmentRepo } from '../repo';
import { setManifestsForTests } from '../services';
import { PLANNER_SCOPE } from '../settings';

// Planner hub 2, package 9: „Vorbereiten …“ / „Danach …“ – the field's own action with a lead chip. Monday 30 Nov
// 2026, invented data.
const NOW = new Date(2026, 10, 30, 9, 0).getTime();
const MODULES = ['todos', 'planner', 'calendar', 'invoices'];
const manifests = MODULES.map((id) => getManifest(id)!);
const repo = (module: string, collection: string) =>
  createCollectionRepo(getManifest(module)!, collection);
const live = async (table: string) =>
  (await db.table(table).toArray()).filter((r) => r.deletedAt === null);
const messages = () => useUiStore.getState().toasts.map((x) => x.message);
const modulesRow = (id: string) =>
  db.table('_modules').put({
    id,
    enabled: true,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of db.tables) await t.clear();
  await repo('todos', 'list').create({ name: 'Eingang', order: 0 }, { id: 'inbox' });
  await repo('calendar', 'event').createMany([
    {
      id: 'ev1',
      data: {
        title: 'Friseur',
        allDay: false,
        startDate: '2026-12-02',
        startTime: '15:00',
        endTime: '16:00',
      },
    },
  ]);
  for (const id of MODULES) await modulesRow(id);
  await setSettings(PLANNER_SCOPE, { horizonDays: '14' });
  bus.clear();
  useUiStore.setState({ toasts: [] });
  setManifestsForTests(async () => manifests);
});
afterEach(() => {
  setNow();
  setManifestsForTests(undefined);
  bus.clear();
});

const lead = (over: Partial<FieldLead> = {}): FieldLead => ({
  ref: { module: 'calendar', id: 'ev1' },
  title: 'Friseur',
  date: '2026-12-02',
  rel: 'before',
  shift: false,
  ...over,
});

describe('the field with a lead chip', () => {
  it('a ToDo on the appointment’s day, one `before` link row, no `links[]` – one undo entry takes all back', async () => {
    const depth = undoDepth();
    expect(await addFromField('Bargeld holen', {}, undefined, undefined, lead())).toBe(true);
    const [task] = await live('todos_task');
    expect(task.title).toBe('Bargeld holen');
    expect(task.links).toBeUndefined();
    expect((await assignmentRepo.active().toArray()).map((r) => r.date)).toEqual(['2026-12-02']);
    const links = await live('_links');
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      from: { module: 'todos', id: task.id },
      to: { module: 'calendar', id: 'ev1' },
      rel: 'before',
      label: 'Friseur',
    });
    expect(messages()[0]).toBe('Liegt auf Mi, vor Friseur.');
    expect(undoDepth()).toBe(depth + 1);
    await undoLast();
    expect(await live('todos_task')).toHaveLength(0);
    expect(await live('_links')).toHaveLength(0);
    expect(await live('planner_assignment')).toHaveLength(0);
  });

  it('A3 lies a day earlier („nach“: later); K7b says „nach“', async () => {
    expect(leadDay(lead({ shift: true }))).toBe('2026-12-01');
    expect(leadDay(lead({ rel: 'after', shift: true }))).toBe('2026-12-03');
    expect(
      await addFromField('Haare föhnen', {}, undefined, undefined, lead({ rel: 'after' })),
    ).toBe(true);
    expect(messages()[0]).toBe('Liegt auf Mi, nach Friseur.');
    expect((await live('_links'))[0].rel).toBe('after');
  });

  it('his own day word wins over the chip’s day; the link stays', async () => {
    expect(await addFromField('Bargeld holen Freitag', {}, undefined, undefined, lead())).toBe(
      true,
    );
    expect((await assignmentRepo.active().toArray()).map((r) => r.date)).toEqual(['2026-12-04']);
    expect(await live('_links')).toHaveLength(1);
  });

  it('a task with steps takes the chip; any other kind leaves it unapplied', async () => {
    expect(
      await addKindFromField(
        { kind: 'steps', title: 'Packen', steps: ['Schirm', 'Karte'] },
        {},
        undefined,
        lead(),
      ),
    ).toBe(true);
    expect((await live('_links'))[0]).toMatchObject({ rel: 'before' });
    await db.table('_links').clear();
    expect(
      await addKindFromField(
        {
          kind: 'invoice',
          fields: { title: 'Salon', amountMinor: 3000, date: '2026-12-02' },
          deadline: '2026-12-02',
        },
        {},
        undefined,
        lead(),
      ),
    ).toBe(true);
    expect(await live('_links')).toHaveLength(0);
  });
});

describe('the appointment behind a blocker', () => {
  it('a timed event with an entity carries its ref; an external one and a reminder do not', () => {
    const out = calendarBlockers([
      {
        id: 'ev1:2026-12-02',
        entityId: 'ev1',
        source: 'calendar',
        kind: 'event',
        title: 'Friseur',
        date: '2026-12-02',
        time: '15:00',
        endTime: '16:00',
        allDay: false,
        to: '/calendar?view=day&date=2026-12-02',
      },
      {
        id: 'x1:2026-12-02',
        source: 'calendar',
        kind: 'external',
        title: 'Team',
        date: '2026-12-02',
        time: '10:00',
        allDay: false,
      },
    ]);
    expect(out[0]!.ref).toEqual({
      module: 'calendar',
      id: 'ev1',
      item: 'ev1:2026-12-02',
      to: '/calendar?view=day&date=2026-12-02',
    });
    expect(out[1]!.ref).toBeUndefined();
  });
});
