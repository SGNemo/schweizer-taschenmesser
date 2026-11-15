import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, type TaschenmesserDB } from '@/core/db/db';
import { addLinkIfAbsent, linkEntries, removeLink } from '@/core/entitylinks';
import { copyTodoLinks } from '@/core/entitylinks/migrate';
import { bus } from '@/core/events';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { runSync } from '@/core/sync/engine';
import { MemoryServer } from '@/core/sync/testing';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import { taskRepo } from '../repo';
import start from '../services';

/**
 * Planner hub S5 (P46, P52): a ToDo requested with a link writes its link-table row right away, so the note or
 * the event it came from lists it at once – and on a second device after a sync.
 */
beforeEach(async () => {
  for (const t of ['todos_task', 'todos_list', '_links']) await db.table(t).clear();
  bus.clear();
});

describe('a requested ToDo’s link, read from its other end', () => {
  it('the event lists its preparation ToDo at once (no app start needed)', async () => {
    const stop = start();
    try {
      await bus.emit('todo.requested', {
        title: 'Unterlagen mitnehmen',
        link: { kind: 'event', id: 'ev1', label: 'Zahnarzt' },
      });
      const [task] = await taskRepo.active().toArray();
      expect(task?.links).toEqual([{ kind: 'event', id: 'ev1', label: 'Zahnarzt' }]);
      const back = await linkEntries({ module: 'calendar', id: 'ev1' });
      expect(back).toHaveLength(1);
      expect(back[0]).toMatchObject({
        direction: 'in',
        other: { module: 'todos', id: task!.id },
        link: { rel: 'origin', label: 'Zahnarzt' },
      });
      // The start-up copy of `links[]` finds the row present and writes nothing twice.
      expect(await copyTodoLinks()).toBe(0);
    } finally {
      stop();
    }
  });

  it('a note line sends its page: the ToDo leads back to the note', async () => {
    const stop = start();
    try {
      await bus.emit('todo.requested', {
        title: 'Reifen wechseln',
        link: { kind: 'note', id: 'n1', label: 'Auto' },
      });
      const [task] = await taskRepo.active().toArray();
      expect(task?.links).toEqual([{ kind: 'note', id: 'n1', label: 'Auto' }]);
      const out = await linkEntries({ module: 'todos', id: task!.id });
      expect(out.map((e) => [e.direction, e.other])).toEqual([
        ['out', { module: 'notes', id: 'n1' }],
      ]);
    } finally {
      stop();
    }
  });

  it('a ToDo without a link writes no row', async () => {
    const stop = start();
    try {
      await bus.emit('todo.requested', { title: 'Milch' });
      expect(await db.table('_links').count()).toBe(0);
    } finally {
      stop();
    }
  });
});

describe('the two-way link on a second device', () => {
  let clock = 1_800_000_000_000;
  const dbs: TaschenmesserDB[] = [];
  beforeEach(() => {
    clock = 1_800_000_000_000;
    setNow(() => (clock += 10));
  });
  afterEach(async () => {
    setNow();
    for (const d of dbs.splice(0)) {
      d.close();
      await d.delete();
    }
  });

  it('the event on B lists the ToDo made on A; the ToDo on B leads to the event', async () => {
    const server = new MemoryServer();
    const device = () => {
      const d = createTestDb();
      dbs.push(d);
      const storage = new DexieStorageAdapter(d);
      return { db: d, sync: () => runSync({ storage, adapter: server.adapter() }) };
    };
    const a = device();
    const b = device();
    // What `addRequested` writes on A (its row through the link store).
    await addLinkIfAbsent(
      {
        from: { module: 'todos', id: 'task-1' },
        to: { module: 'calendar', id: 'ev1' },
        rel: 'origin',
        label: 'Zahnarzt',
      },
      a.db,
    );
    await a.sync();
    await b.sync();
    const fromEvent = await linkEntries({ module: 'calendar', id: 'ev1' }, b.db);
    expect(fromEvent.map((e) => [e.direction, e.other])).toEqual([
      ['in', { module: 'todos', id: 'task-1' }],
    ]);
    const fromTodo = await linkEntries({ module: 'todos', id: 'task-1' }, b.db);
    expect(fromTodo.map((e) => [e.direction, e.other])).toEqual([
      ['out', { module: 'calendar', id: 'ev1' }],
    ]);
  });

  it('a removal on B with a clock slightly behind A stays removed: A writes the row stamped like the copy', async () => {
    const server = new MemoryServer();
    const replica = (d: TaschenmesserDB) => {
      const storage = new DexieStorageAdapter(d);
      return { db: d, sync: () => runSync({ storage, adapter: server.adapter() }) };
    };
    // A is the app's own database: `todo.requested` writes there.
    for (const table of ['_outbox', '_meta']) await db.table(table).clear();
    const a = replica(db);
    const bDb = createTestDb();
    dbs.push(bDb);
    const b = replica(bDb);
    await a.sync(); // the first round uploads everything; the case below needs an ordinary one

    const stop = start();
    const before = clock;
    try {
      await bus.emit('todo.requested', {
        title: 'Unterlagen mitnehmen',
        link: { kind: 'event', id: 'ev1', label: 'Zahnarzt' },
      });
    } finally {
      stop();
    }
    const [task] = await taskRepo.active().toArray();
    const todo = { module: 'todos', id: task!.id };
    expect(await linkEntries(todo, a.db)).toHaveLength(1);

    // A push ran between the task and its row: B gets the task only, then copies it itself.
    const outbox = db.table('_outbox');
    const rowQueued = await outbox
      .filter((r: { collection: string }) => r.collection === '_links')
      .toArray();
    expect(rowQueued).toHaveLength(1);
    await outbox.bulkDelete(
      rowQueued.map((r: { collection: string; id: string }) => [r.collection, r.id]),
    );
    await a.sync();
    await outbox.bulkPut(rowQueued);
    await b.sync();
    expect(await b.db.table('_links').count()).toBe(0);
    expect(await copyTodoLinks(b.db)).toBe(1);

    // B's clock is slightly behind A's: the removal there is stamped before A wrote its row by the wall clock.
    clock = before;
    const [entry] = await linkEntries(todo, b.db);
    await removeLink(entry!.id, b.db);
    await b.sync();
    await a.sync();
    await b.sync();
    await a.sync();
    for (const d of [a, b]) expect(await linkEntries(todo, d.db)).toEqual([]);
  });
});
