import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { syncedTableNames } from '@/core/db/schema';
import { wipeModuleData } from '@/core/modules/activation';
import { allManifests, getManifest } from '@/core/modules/registry';
import { purgeTombstones, TOMBSTONE_RETENTION_MS } from '@/core/sync/tombstones';
import { setNow } from '@/core/time/now';
import { undoable, undoLast } from '@/core/undo';
import { captureId } from '@/quickCapture/targets';
import {
  addLink,
  addLinkIfAbsent,
  addLinksIfAbsent,
  linkEntries,
  linkId,
  linksOf,
  plannedDay,
  removeLink,
} from './index';
import {
  copyTodoLinks,
  copyTodoLinksAfterSync,
  copyTodoLinksAtStart,
  TODO_LINKS_COPIED_KEY,
  todoLink,
} from './migrate';
import { LINKS_TABLE, linksRepo } from './store';
import type { EntityLink } from './types';

const todos = getManifest('todos')!;
const calendar = getManifest('calendar')!;
const planner = getManifest('planner')!;
const tasks = createCollectionRepo(todos, 'task');
const events = createCollectionRepo(calendar, 'event');
const assignments = createCollectionRepo(planner, 'assignment');

const T0 = new Date(2026, 10, 15, 10, 0).getTime();
let clock = T0;

const task = (title: string, extra: Record<string, unknown> = {}) =>
  tasks.create({ listId: 'inbox', title, done: false, priority: 0, order: 0, ...extra });
const event = (title: string) => events.create({ title, allDay: true, startDate: '2026-11-17' });
const link = (from: string, to: string, extra: Partial<EntityLink> = {}): EntityLink => ({
  from: { module: 'todos', id: from },
  to: { module: 'calendar', id: to },
  rel: 'origin',
  label: 'Zahnarzt',
  ...extra,
});
const rows = () => db.table(LINKS_TABLE).toArray();
const moduleRow = (id: string, enabled: boolean) =>
  db.table('_modules').put({
    id,
    enabled,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });

beforeEach(async () => {
  clock = T0;
  setNow(() => (clock += 10));
  for (const t of [
    LINKS_TABLE,
    'todos_task',
    'calendar_event',
    'planner_assignment',
    '_modules',
    '_meta',
    '_outbox',
  ])
    await db.table(t).clear();
});
afterEach(() => setNow());

describe('the row', () => {
  it('is envelope + link + both keys, under a hashed id that names nothing', async () => {
    await addLink(link('t1', 'e1', { on: '2026-11-03' }));
    const [row] = await rows();
    expect(row).toMatchObject({
      from: { module: 'todos', id: 't1' },
      to: { module: 'calendar', id: 'e1' },
      rel: 'origin',
      label: 'Zahnarzt',
      on: '2026-11-03',
      fromKey: 'todos:t1',
      toKey: 'calendar:e1',
      deletedAt: null,
    });
    expect(Object.keys(row._f).sort()).toEqual(
      ['deletedAt', 'from', 'fromKey', 'label', 'on', 'rel', 'to', 'toKey'].sort(),
    );
    expect(row.id).toMatch(/^[0-9a-f]{64}$/);
    for (const part of ['todos', 'calendar', 't1', 'e1', 'origin'])
      expect(row.id).not.toContain(part);
    expect(row.id).toBe(await linkId(link('t1', 'e1')));
    // Queued for sync like any synced record.
    expect(await db.table('_outbox').get([LINKS_TABLE, row.id])).toBeTruthy();
  });

  it('the id depends on from, rel and to – not on label or day; the quick-capture id is the same hash, cut', async () => {
    const a = await linkId(link('t1', 'e1'));
    expect(await linkId(link('t1', 'e1', { label: 'anders', on: '2026-01-01' }))).toBe(a);
    expect(await linkId(link('t1', 'e1', { rel: 'dunning' }))).not.toBe(a);
    expect(await linkId(link('t2', 'e1'))).not.toBe(a);
    expect(await linkId(link('t1', 'e2'))).not.toBe(a);
    expect(await captureId(['todos:t1', 'origin', 'calendar:e1'])).toBe(a.slice(0, 16));
  });
});

describe('addLink / addLinkIfAbsent / removeLink', () => {
  it('adding twice writes once; the undo removes the link (a tombstone)', async () => {
    const undo = await addLink(link('t1', 'e1'));
    const again = await addLink(link('t1', 'e1', { label: 'neuer Titel' }));
    expect(await rows()).toHaveLength(1);
    expect((await rows())[0].label).toBe('Zahnarzt'); // a live row keeps the label of the time
    await again(); // the second add did nothing, so its undo does nothing
    expect((await rows())[0].deletedAt).toBeNull();
    await undo();
    expect((await rows())[0].deletedAt).not.toBeNull();
  });

  it('a tap brings a removed link back (same row, label and day of now); its undo removes it again', async () => {
    await addLink(link('t1', 'e1'));
    const id = await linkId(link('t1', 'e1'));
    await removeLink(id);
    const undo = await addLink(link('t1', 'e1', { label: 'Zahnarzt neu', on: '2026-11-20' }));
    expect(await rows()).toHaveLength(1);
    expect((await rows())[0]).toMatchObject({
      id,
      deletedAt: null,
      label: 'Zahnarzt neu',
      on: '2026-11-20',
    });
    await undo();
    expect((await rows())[0].deletedAt).not.toBeNull();
  });

  it('a programmatic writer creates only when absent – a tombstone counts as present', async () => {
    expect(await addLinkIfAbsent(link('t1', 'e1'))).toBe(true);
    expect(await addLinkIfAbsent(link('t1', 'e1'))).toBe(false);
    await removeLink(await linkId(link('t1', 'e1')));
    expect(await addLinkIfAbsent(link('t1', 'e1'))).toBe(false);
    expect((await rows())[0].deletedAt).not.toBeNull();
    expect(await linkEntries({ module: 'todos', id: 't1' })).toEqual([]);
  });

  it('guards: the label is cut at 120, the day must be a date, an unknown rel reads as about', async () => {
    await addLink(link('t1', 'e1', { label: 'x'.repeat(300) }));
    expect((await rows())[0].label).toHaveLength(120);
    await expect(addLink(link('t1', 'e2', { on: '3. Nov.' }))).rejects.toThrow(/YYYY-MM-DD/);
    await expect(addLink(link('t1', 'e2', { on: '2026-11-03T10:00' }))).rejects.toThrow();
    await expect(
      addLink({ ...link('t1', 't1'), to: { module: 'todos', id: 't1' } }),
    ).rejects.toThrow(/itself/);
    await expect(addLink(link('t1', 'x'.repeat(129)))).rejects.toThrow(/malformed/);
    // A newer app's rel arrives by sync: stored as it is, read as `about`.
    await linksRepo().create(
      {
        from: { module: 'todos', id: 't9' },
        to: { module: 'calendar', id: 'e9' },
        rel: 'supersedes',
        label: 'L',
        fromKey: 'todos:t9',
        toKey: 'calendar:e9',
      },
      { id: 'from-a-newer-app' },
    );
    const [entry] = await linkEntries({ module: 'todos', id: 't9' });
    expect(entry!.link.rel).toBe('about');
    // A row that arrived with an over-long label or a bad day (not through `addLink`) is cut on read.
    await db.table(LINKS_TABLE).update('from-a-newer-app', { label: 'y'.repeat(200), on: 'bald' });
    const [cut] = await linkEntries({ module: 'todos', id: 't9' });
    expect(cut!.link.label).toHaveLength(120);
    expect(cut!.link.on).toBeUndefined();
  });

  it('a row whose keys do not belong to its refs is not read', async () => {
    await addLink(link('t1', 'e1'));
    const id = await linkId(link('t1', 'e1'));
    await db.table(LINKS_TABLE).update(id, { toKey: 'calendar:other' });
    expect(await linkEntries({ module: 'todos', id: 't1' })).toEqual([]);
    expect(await linkEntries({ module: 'calendar', id: 'other' })).toEqual([]);
  });
});

describe('removeLink and the ToDo’s own field', () => {
  const legacy = [
    { kind: 'event', id: 'e1', label: 'Zahnarzt' },
    { kind: 'note', id: 'n1', label: 'Einkaufsliste' },
  ];

  it('removing a ToDo’s link also strips the matching entry of its `links[]`; one undo restores both', async () => {
    const t = await task('Mit Links', { links: legacy });
    await copyTodoLinks();
    const id = await linkId(todoLink(t.id, legacy[0] as never));
    await undoable('Entfernt', () => removeLink(id));
    expect((await tasks.get(t.id))!.links).toEqual([legacy[1]]);
    expect((await linkEntries({ module: 'todos', id: t.id })).map((l) => l.other.id)).toEqual([
      'n1',
    ]);
    // Past the purge of the tombstone the copy finds nothing to bring back.
    await db.table(LINKS_TABLE).delete(id);
    expect(await copyTodoLinks()).toBe(0);

    await db.table(LINKS_TABLE).clear();
    await tasks.update(t.id, { links: legacy });
    await copyTodoLinks();
    await undoable('Entfernt', () => removeLink(id));
    await undoLast();
    expect((await tasks.get(t.id))!.links).toEqual(legacy);
    expect(await linkEntries({ module: 'todos', id: t.id })).toHaveLength(2);
  });

  it('the last entry leaves no empty array; another live row to the same target keeps the entry', async () => {
    const t = await task('Eins', { links: [legacy[0]] });
    await copyTodoLinks();
    await addLink({ ...todoLink(t.id, legacy[0] as never), rel: 'about' });
    await removeLink(await linkId({ ...todoLink(t.id, legacy[0] as never), rel: 'about' }));
    expect((await tasks.get(t.id))!.links).toEqual([legacy[0]]);
    await removeLink(await linkId(todoLink(t.id, legacy[0] as never)));
    expect((await tasks.get(t.id))!.links).toBeUndefined();
  });

  it('a link carried by another module, a missing task or an unknown id touch no task', async () => {
    const t = await task('Unberührt', { links: legacy });
    await addLink({
      from: { module: 'invoices', id: 'i1' },
      to: { module: 'calendar', id: 'e1' },
      rel: 'about',
      label: 'Zahnarzt',
    });
    await removeLink(
      await linkId({
        from: { module: 'invoices', id: 'i1' },
        to: { module: 'calendar', id: 'e1' },
        rel: 'about',
      }),
    );
    await addLink(link('no-such-task', 'e1'));
    await removeLink(await linkId(link('no-such-task', 'e1')));
    await removeLink('no-such-row');
    expect((await tasks.get(t.id))!.links).toEqual(legacy);
  });
});

describe('linksOf', () => {
  it('reads both directions and resolves the other end through its module', async () => {
    const t = await task('Vorbereiten');
    const e = await event('Zahnarzt heute');
    await addLink(link(t.id, e.id));
    await addLink(link(t.id, 'weg', { label: 'Alter Termin' }));

    const out = await linksOf({ module: 'todos', id: t.id });
    expect(out.map((l) => [l.direction, l.other.id, l.state.state])).toEqual([
      ['out', e.id, 'alive'],
      ['out', 'weg', 'gone'],
    ]);
    expect(out[0]!.state).toMatchObject({ title: 'Zahnarzt heute', to: `/calendar?open=${e.id}` });
    expect(out[1]!.link.label).toBe('Alter Termin');

    const back = await linksOf({ module: 'calendar', id: e.id });
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({
      direction: 'in',
      other: { module: 'todos', id: t.id },
      state: { state: 'alive', title: 'Vorbereiten' },
    });
    expect(back[0]!.id).toBe(out[0]!.id);
  });

  it('a removed link is in neither direction; a switched-off target answers unavailable, the row stays', async () => {
    const t = await task('A');
    const e = await event('B');
    await addLink(link(t.id, e.id));
    await moduleRow('calendar', false);
    expect((await linksOf({ module: 'todos', id: t.id }))[0]!.state).toEqual({
      state: 'unavailable',
    });
    await removeLink(await linkId(link(t.id, e.id)));
    expect(await linksOf({ module: 'todos', id: t.id })).toEqual([]);
    expect(await linksOf({ module: 'calendar', id: e.id })).toEqual([]);
  });
});

describe('plannedDay', () => {
  const assign = (itemKey: string, date: string, k = 0) =>
    assignments.create(
      { itemKey, k, of: 1, date, minutes: 30, order: 0, reason: 'new' },
      { id: `${itemKey}#${k}@${date}` },
    );

  it('is undefined while the planner is off, whatever is stored', async () => {
    await assign('invoices:i1', '2026-11-17');
    expect(await plannedDay({ module: 'invoices', id: 'i1' })).toBeUndefined();
  });

  it('is the earliest live day from today on of the thing itself', async () => {
    await moduleRow('planner', true);
    await assign('invoices:i1', '2026-11-19');
    await assign('invoices:i1', '2026-11-17', 1);
    await assign('invoices:i1', '2026-11-10', 2); // a past day is no „Im Plan“
    const gone = await assign('invoices:i1', '2026-11-16', 3);
    await assignments.remove(gone.id);
    expect(await plannedDay({ module: 'invoices', id: 'i1' })).toBe('2026-11-17');
    expect(await plannedDay({ module: 'invoices', id: 'other' })).toBeUndefined();
  });

  it('for a thing that is no plan item itself: the day of a ToDo linking to it', async () => {
    await moduleRow('planner', true);
    const e = await event('Elternabend');
    await addLink(link('t-late', e.id));
    await addLink(link('t-early', e.id));
    await addLink(link('t-unplanned', e.id));
    await assign('todos:t-late', '2026-11-20');
    await assign('todos:t-early', '2026-11-18');
    expect(await plannedDay({ module: 'calendar', id: e.id })).toBe('2026-11-18');
    // A removed link no longer counts.
    await removeLink(await linkId(link('t-early', e.id)));
    expect(await plannedDay({ module: 'calendar', id: e.id })).toBe('2026-11-20');
  });
});

describe('orphans', () => {
  it('a purged tombstone of the carrying record soft-deletes its links; the link row is purged later like any row', async () => {
    const names = syncedTableNames(allManifests);
    const kept = await task('bleibt');
    const dead = await task('weg');
    await addLink(link(kept.id, 'e1'));
    await addLink(link(dead.id, 'e1'));
    await addLink(link(dead.id, 'e2'));
    await tasks.remove(dead.id);
    await db.table('_outbox').clear(); // everything was pushed

    // Inside the retention nothing happens: a deleted task can still come back.
    expect(await purgeTombstones(db, names, clock + 1000)).toBe(0);
    expect((await rows()).filter((r) => r.deletedAt === null)).toHaveLength(3);

    const later = clock + TOMBSTONE_RETENTION_MS + 1000;
    setNow(() => later);
    expect(await purgeTombstones(db, names, later)).toBe(1);
    expect(await db.table('todos_task').get(dead.id)).toBeUndefined();
    const after = await rows();
    expect(after).toHaveLength(3); // tombstones, not hard deletes: the removal syncs
    expect(
      after
        .filter((r) => r.deletedAt !== null)
        .map((r) => r.toKey)
        .sort(),
    ).toEqual(['calendar:e1', 'calendar:e2']);
    expect(after.find((r) => r.fromKey === `todos:${kept.id}`)!.deletedAt).toBeNull();
    expect(await db.table('_outbox').where('collection').equals(LINKS_TABLE).count()).toBe(2);

    // Once pushed and past the retention again, the link tombstones go like any row.
    await db.table('_outbox').clear();
    const muchLater = later + TOMBSTONE_RETENTION_MS + 1000;
    expect(await purgeTombstones(db, names, muchLater)).toBe(2);
    expect(await rows()).toHaveLength(1);
  });

  it('a record that is merely missing on this device is never a reason, and a purged target does not touch the link', async () => {
    const names = syncedTableNames(allManifests);
    await addLink(link('never-synced-here', 'e1'));
    const e = await event('Ziel');
    const t = await task('Träger');
    await addLink(link(t.id, e.id));
    await events.remove(e.id);
    await db.table('_outbox').clear();
    const later = clock + TOMBSTONE_RETENTION_MS + 1000;
    expect(await purgeTombstones(db, names, later)).toBe(1); // the event's tombstone
    expect((await rows()).every((r) => r.deletedAt === null)).toBe(true);
  });

  it('wiping a module tombstones the links its things carry, not the ones that lead to it', async () => {
    const t = await task('Aufgabe');
    await addLink(link(t.id, 'e1'));
    await addLink({
      from: { module: 'invoices', id: 'i1' },
      to: { module: 'todos', id: t.id },
      rel: 'about',
      label: 'Aufgabe',
    });
    await wipeModuleData(todos);
    const after = await rows();
    expect(after.find((r) => r.fromKey === `todos:${t.id}`)!.deletedAt).not.toBeNull();
    expect(after.find((r) => r.fromKey === 'invoices:i1')!.deletedAt).toBeNull();
  });
});

describe('copy of the ToDo links', () => {
  const legacy = [
    { kind: 'event', id: 'e1', label: 'Zahnarzt' },
    { kind: 'note', id: 'n1', label: 'Einkaufsliste' },
  ];

  it('copies every entry once, with the id any device would give it; the task keeps its field', async () => {
    const t = await task('Mit Links', { links: legacy });
    await task('Ohne');
    expect(await copyTodoLinks()).toBe(2);
    expect(await copyTodoLinks()).toBe(0);
    const out = await linkEntries({ module: 'todos', id: t.id });
    expect(out.map((l) => [l.other.module, l.other.id, l.link.rel, l.link.label]).sort()).toEqual([
      ['calendar', 'e1', 'origin', 'Zahnarzt'],
      ['notes', 'n1', 'origin', 'Einkaufsliste'],
    ]);
    expect(out.find((l) => l.other.id === 'e1')!.id).toBe(
      await linkId(todoLink(t.id, { kind: 'event', id: 'e1', label: 'Zahnarzt' })),
    );
    expect((await tasks.get(t.id))!.links).toEqual(legacy);
    // The reverse read is what the copy is for.
    expect(await linkEntries({ module: 'notes', id: 'n1' })).toHaveLength(1);
  });

  it('never brings back a link the person removed, and skips entries it cannot read', async () => {
    const t = await task('Mit Links', {
      links: [...legacy, { kind: 'event', id: 'e3', label: 'Dritter' }],
    });
    await copyTodoLinks();
    await removeLink(await linkId(todoLink(t.id, legacy[0] as never)));
    // An older app wrote something this one cannot read (bypassing the schema, as a pull does).
    await db.table('todos_task').update(t.id, {
      links: [...legacy, { kind: 'password', id: 'a1', label: 'Tresor' }, { id: 'x' }, null],
    });
    expect(await copyTodoLinks()).toBe(0);
    const live = await linkEntries({ module: 'todos', id: t.id });
    expect(live.map((l) => l.other.id).sort()).toEqual(['e3', 'n1']);
    expect(JSON.stringify(await rows())).not.toContain('Tresor');
  });

  it('a copied row carries the stamp of the task’s `links` field on every field – not "now"', async () => {
    const t = await task('Gestempelt', { links: [legacy[0]] });
    const stamp = (await db.table('todos_task').get(t.id))._f.links as string;
    clock += 60_000; // the copy runs a minute later
    await copyTodoLinks();
    const [row] = await rows();
    expect(new Set(Object.values(row._f))).toEqual(new Set([stamp]));
    expect(row.deletedAt).toBeNull();
    // Queued for upload like a written row.
    expect(await db.table('_outbox').get([LINKS_TABLE, row.id])).toBeTruthy();
  });

  it('at app start: without sync every start copies; with sync only once a pull completed here', async () => {
    const t = await task('Erste', { links: [legacy[0]] });
    await copyTodoLinksAtStart(db, true); // sync configured, nothing pulled yet: wait
    expect(await rows()).toHaveLength(0);
    expect(await db.table('_meta').get(TODO_LINKS_COPIED_KEY)).toBeUndefined();

    await copyTodoLinksAfterSync(db, false); // the first completed round, even one that moved nothing
    expect(await rows()).toHaveLength(1);
    expect(await db.table('_meta').get(TODO_LINKS_COPIED_KEY)).toBeTruthy();

    await tasks.update(t.id, { links: legacy });
    await copyTodoLinksAfterSync(db, false); // a later round that moved nothing: no scan
    expect(await rows()).toHaveLength(1);
    await copyTodoLinksAtStart(db, true); // …but every start after the first copy
    expect(await rows()).toHaveLength(2);

    await db.table(LINKS_TABLE).clear();
    await db.table('_meta').clear();
    await copyTodoLinksAtStart(db, false); // no sync: at once, and again at the next start
    expect(await rows()).toHaveLength(2);
    await tasks.update(t.id, { links: [...legacy, { kind: 'invoice', id: 'i1', label: 'R' }] });
    await copyTodoLinksAtStart(db, false);
    expect(await rows()).toHaveLength(3);
  });

  it('in bulk: one unreadable or forbidden link does not stop the others', async () => {
    const written = await addLinksIfAbsent([
      link('t1', 'e1'),
      { ...link('t1', 'e2'), to: { module: 'accounts', id: 'a1' } },
      link('t1', 'e1'), // twice in one batch
      { ...link('t1', 'e3'), on: 'kaputt' },
      link('t1', 'e4'),
    ]);
    expect(written).toBe(2);
    expect((await rows()).map((r) => r.toKey).sort()).toEqual(['calendar:e1', 'calendar:e4']);
  });
});
