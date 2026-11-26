import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { getMeta } from '@/core/db/metaKv';
import { createCollectionRepo } from '@/core/db/repo';
import { addLink } from '@/core/entitylinks';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { undoDepth, undoLast } from '@/core/undo';
import { useUiStore } from '@/stores/ui';
import { addFromField, addKindFromField } from '../actions';
import linkTarget from '../linkTarget';
import { setManifestsForTests } from '../services';
import { topicRepo } from '../repo';
import { topicSchema } from '../schema';
import {
  deleteTopic,
  renameTopic,
  setTopic,
  setTopicFilter,
  shownMembers,
  TOPIC_FILTER_KEY,
  TOPIC_LAST_KEY,
  topicOfLinks,
  topicsOf,
  topicThing,
  topicTitle,
} from '../topic';

// Planner hub 2, package 11: topics as a bracket. Invented data.
const todo = (id: string) => ({ module: 'todos', id });
const live = async (table: string) =>
  (await db.table(table).toArray()).filter((r) => r.deletedAt === null);
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
  setNow(() => new Date(2026, 10, 30, 9, 0).getTime());
  for (const t of db.tables) await t.clear();
  for (const id of ['todos', 'planner', 'invoices']) await modulesRow(id);
  const tasks = createCollectionRepo(getManifest('todos')!, 'task');
  await createCollectionRepo(getManifest('todos')!, 'list').create(
    { name: 'Eingang', order: 0 } as never,
    { id: 'inbox' },
  );
  for (const id of ['a', 'b', 'c'])
    await tasks.create({ title: `Ding ${id}`, listId: 'inbox' } as never, { id });
  useUiStore.setState({ toasts: [] });
});
afterEach(() => setNow());

describe('„Thema …“', () => {
  it('a new name makes the topic and links the things in one undo entry; toast T8', async () => {
    const depth = undoDepth();
    const id = await setTopic([todo('a'), todo('b')], { title: '  Umzug  ' });
    expect(id).toMatch(/^t_/);
    expect((await topicRepo.get(id!))?.title).toBe('Umzug');
    const links = await live('_links');
    expect(links.map((l) => [l.from.id, l.rel, l.to.id, l.label]).sort()).toEqual([
      [id, 'topic', 'a', 'Umzug'],
      [id, 'topic', 'b', 'Umzug'],
    ]);
    expect(useUiStore.getState().toasts.at(-1)?.message).toBe('2 Dinge gehören jetzt zu „Umzug“.');
    expect(undoDepth()).toBe(depth + 1);
    await undoLast();
    expect(await live('_links')).toHaveLength(0);
    expect(await live('planner_topic')).toHaveLength(0);
  });

  it('one topic per thing: a second replaces the first in the same undo entry', async () => {
    const move = (await setTopic([todo('a')], { title: 'Umzug' }))!;
    const tax = (await setTopic([todo('a')], { title: 'Steuer' }))!;
    expect((await live('_links')).map((l) => l.from.id)).toEqual([tax]);
    await undoLast();
    expect((await live('_links')).map((l) => l.from.id)).toEqual([move]);
    // `null`: out of every topic.
    await setTopic([todo('a')], null);
    expect(await live('_links')).toHaveLength(0);
  });

  it('two devices gave a thing two topics offline: the later row is read; the next „Thema …“ tidies up', async () => {
    const move = (await setTopic([todo('a')], { title: 'Umzug' }))!;
    await topicRepo.create({ title: 'Steuer' }, { id: 't_00000000-steuer' });
    setNow(() => new Date(2026, 10, 30, 10, 0).getTime());
    // As a pull would bring it: another device's link to the same thing.
    await addLink({
      from: { module: 'planner', id: 't_00000000-steuer' },
      to: todo('a'),
      rel: 'topic',
      label: 'Steuer',
    });
    expect((await live('_links')).length).toBe(2);
    expect((await topicsOf([todo('a')])).get('todos:a')).toBe('t_00000000-steuer');
    // The filter reads the same: the thing shows under the later topic only.
    expect([...(await shownMembers('t_00000000-steuer'))]).toEqual(['todos:a']);
    expect((await shownMembers(move)).size).toBe(0);
    await setTopic([todo('a')], { id: move });
    expect((await live('_links')).map((l) => l.from.id)).toEqual([move]);
  });

  it('a link from a topic deleted elsewhere never shadows the live one', async () => {
    const move = (await setTopic([todo('a')], { title: 'Umzug' }))!;
    setNow(() => new Date(2026, 10, 30, 10, 0).getTime());
    // Device B gave the thing „Steuer“ offline while device A deleted „Steuer“: the link arrives, the topic is gone.
    await addLink({
      from: { module: 'planner', id: 't_00000000-steuer' },
      to: todo('a'),
      rel: 'topic',
      label: 'Steuer',
    });
    expect((await topicsOf([todo('a')])).get('todos:a')).toBe(move);
    expect([...(await shownMembers(move))]).toEqual(['todos:a']);
  });

  it('the later of two rows; a tie by the row id', () => {
    const row = (from: string, updatedAt: number, id: string) => ({
      id,
      updatedAt,
      link: { from: { module: 'planner', id: from } },
    });
    expect(topicOfLinks([row('t_x', 1, 'r1'), row('t_y', 2, 'r2')])).toBe('t_y');
    expect(topicOfLinks([row('t_x', 2, 'r9'), row('t_y', 2, 'r2')])).toBe('t_x');
    expect(topicOfLinks([])).toBeUndefined();
  });

  it('remembers the last used topic on this device only', async () => {
    const id = await setTopic([todo('a')], { title: 'Umzug' });
    expect(await getMeta(TOPIC_LAST_KEY)).toBe(id);
  });

  it('a title: one line, trimmed, at most 60 characters', () => {
    expect(topicTitle('  Umzug \n Wien ')).toBe('Umzug Wien');
    expect(topicTitle('   ')).toBeUndefined();
    expect(Array.from(topicTitle('x'.repeat(80))!)).toHaveLength(60);
    // Counted as the schema counts: an emoji is two, and never cut in half.
    const emoji = topicTitle('😀'.repeat(40))!;
    expect(emoji).toHaveLength(60);
    expect(topicSchema.safeParse({ title: topicTitle('x' + '😀'.repeat(40)) }).success).toBe(true);
  });
});

describe('managing topics', () => {
  it('T9: deleting removes the topic and its links in one undo – no thing is touched; the filter on it ends', async () => {
    const id = (await setTopic([todo('a'), todo('b')], { title: 'Umzug' }))!;
    await setTopicFilter(id);
    const tasksBefore = await live('todos_task');
    await deleteTopic(id);
    expect(await live('_links')).toHaveLength(0);
    expect(await live('planner_topic')).toHaveLength(0);
    expect(await live('todos_task')).toEqual(tasksBefore);
    expect(await getMeta(TOPIC_FILTER_KEY)).toBeNull();
    await undoLast();
    expect(await live('_links')).toHaveLength(2);
    expect((await topicRepo.get(id))?.title).toBe('Umzug');
  });

  it('rename keeps the links', async () => {
    const id = (await setTopic([todo('a')], { title: 'Umzug' }))!;
    expect(await renameTopic(id, 'Umzug Wien')).toBe(true);
    expect((await topicRepo.get(id))?.title).toBe('Umzug Wien');
    expect(await live('_links')).toHaveLength(1);
  });
});

describe('the planner as a link target', () => {
  it('a topic alive with its title; anything else gone', async () => {
    const id = (await setTopic([todo('a')], { title: 'Umzug' }))!;
    expect(await linkTarget.resolve(id)).toEqual({
      state: 'alive',
      title: 'Umzug',
      to: `/planner?topic=${encodeURIComponent(id)}`,
    });
    for (const other of ['pile-money', 'todos:a', 't_', 't_nope-not-there'])
      expect(await linkTarget.resolve(other), other).toEqual({ state: 'gone' });
  });
});

describe('the filter', () => {
  it('is device state: writes nothing that syncs', async () => {
    const id = (await setTopic([todo('a')], { title: 'Umzug' }))!;
    const outbox = (await db.table('_outbox').toArray()).length;
    await setTopicFilter(id);
    await setTopicFilter(null);
    expect((await db.table('_outbox').toArray()).length).toBe(outbox);
  });
});

describe('which rows offer „Thema …“', () => {
  it('a linkable thing (its entity for an occurrence) yes; a pile row and a non-linkable module no', () => {
    expect(topicThing({ moduleId: 'todos', id: 'a', kind: 'todo' })).toEqual({
      module: 'todos',
      id: 'a',
    });
    expect(
      topicThing({
        moduleId: 'subscriptions',
        id: 'sub:2026-12-01',
        entityId: 'sub',
        kind: 'subscription',
      }),
    ).toEqual({ module: 'subscriptions', id: 'sub' });
    expect(topicThing({ moduleId: 'planner', id: 'pile-money', kind: 'pile' })).toBeUndefined();
    expect(topicThing({ moduleId: 'accounts', id: 'x', kind: 'account' })).toBeUndefined();
    expect(topicThing({ moduleId: 'habits', id: 'x', kind: 'habit' })).toBeUndefined();
  });
});

describe('the field while a topic is shown', () => {
  const manifests = ['todos', 'planner', 'invoices'].map((id) => getManifest(id)!);
  beforeEach(() => setManifestsForTests(async () => manifests));
  afterEach(() => setManifestsForTests(undefined));

  it('T11: a new ToDo gets the topic in its one undo entry; toast K8', async () => {
    const id = (await setTopic([todo('a')], { title: 'Umzug' }))!;
    expect(
      await addFromField('Helfer fragen', {}, undefined, undefined, undefined, {
        topic: { id, title: 'Umzug' },
        filtered: { title: 'Umzug' },
      }),
    ).toBe(true);
    const made = (await live('todos_task')).find((x) => x.title === 'Helfer fragen')!;
    expect(
      (await live('_links')).some(
        (l) => l.from.id === id && l.to.id === made.id && l.rel === 'topic',
      ),
    ).toBe(true);
    expect(useUiStore.getState().toasts.at(-1)?.message).toMatch(/^Liegt auf Mo, in „Umzug“\./);
    // One undo takes back the ToDo and its topic link together.
    await undoLast();
    expect((await live('_links')).filter((l) => l.to.id === made.id)).toHaveLength(0);
    expect((await live('todos_task')).some((x) => x.id === made.id)).toBe(false);
  });

  it('a break typed with the chip on takes no topic either: K9', async () => {
    const id = (await setTopic([todo('a')], { title: 'Umzug' }))!;
    expect(
      await addFromField('Pause 2 Std Zocken', {}, undefined, undefined, undefined, {
        topic: { id, title: 'Umzug' },
        filtered: { title: 'Umzug' },
      }),
    ).toBe(true);
    const last = useUiStore.getState().toasts.at(-1)!;
    expect(last.message).toMatch(/\nNicht im Thema „Umzug“$/);
    expect(last.lead?.label).toBe('Alles zeigen');
  });

  it('K9: another kind takes no topic – the toast says so and „Alles zeigen“ ends the filter', async () => {
    const id = (await setTopic([todo('a')], { title: 'Umzug' }))!;
    await setTopicFilter(id);
    expect(
      await addKindFromField(
        {
          kind: 'invoice',
          fields: { title: 'Umzugsfirma', amountMinor: 45000, date: '2026-12-04' },
          deadline: '2026-12-04',
        },
        {},
        undefined,
        undefined,
        { topic: { id, title: 'Umzug' }, filtered: { title: 'Umzug' } },
      ),
    ).toBe(true);
    const last = useUiStore.getState().toasts.at(-1)!;
    expect(last.message).toBe(
      'Rechnung angelegt, liegt unter „Noch ohne Tag“.\nNicht im Thema „Umzug“',
    );
    expect(last.lead?.label).toBe('Alles zeigen');
    // The invoice got no topic.
    expect((await live('_links')).filter((l) => l.to.module === 'invoices')).toHaveLength(0);
    last.lead!.run();
    await vi.waitFor(async () => expect(await getMeta(TOPIC_FILTER_KEY)).toBeNull());
  });

  it('a ToDo whose chip was removed (✕) while a topic is shown: K9 too', async () => {
    expect(
      await addFromField('Wäsche', {}, undefined, undefined, undefined, {
        filtered: { title: 'Umzug' },
      }),
    ).toBe(true);
    expect(useUiStore.getState().toasts.at(-1)?.message).toMatch(/Nicht im Thema „Umzug“$/);
  });
});
