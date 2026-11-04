import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { clearAll, ctxFor, seed, useFixedClock } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { hasWriteListener, setWriteListener, type WriteSignal } from '@/core/db/writeHook';
import { setNow } from '@/core/time/now';
import { taskRepo } from '@/modules/todos/repo';
import { eventsOf, splitTable } from './ingest';
import { processEvent, type EngineDeps } from './engine';
import { listLog } from './log';
import { listNotices } from './notices';
import { resetGuardCache } from './state';
import type { AutomationEvent, Rule } from './types';

describe('repo write hook', () => {
  beforeEach(async () => {
    useFixedClock();
    await clearAll();
    await seed();
  });
  afterAll(() => {
    setWriteListener(undefined);
    setNow();
  });

  it('reports created, updated (with previous values), deleted and restored; nothing when unchanged', async () => {
    const seen: WriteSignal[] = [];
    setWriteListener((s) => seen.push(s));
    const t = await taskRepo.create({ listId: 'inbox', title: 'A' } as never);
    setNow(() => new Date(2026, 8, 29, 11, 0).getTime());
    await taskRepo.update(t.id, { title: 'B' });
    await taskRepo.update(t.id, { title: 'B' });
    await taskRepo.remove(t.id);
    await taskRepo.restore(t.id);
    setWriteListener(undefined);
    expect(seen.map((s) => s.kind)).toEqual(['created', 'updated', 'deleted', 'restored']);
    expect(seen[0]).toMatchObject({ table: 'todos_task', id: t.id, data: { title: 'A' } });
    expect(seen[1]).toMatchObject({ data: { title: 'B' }, before: { title: 'A' } });
    expect(Object.keys(seen[0]!.data!)).not.toContain('deviceId');
  });

  it('costs nothing without a listener: no signal is built, writes work as before', async () => {
    setWriteListener(undefined);
    expect(hasWriteListener()).toBe(false);
    const t = await taskRepo.create({ listId: 'inbox', title: 'quiet' } as never);
    expect(await taskRepo.get(t.id)).toBeDefined();
    setWriteListener(() => undefined);
    expect(hasWriteListener()).toBe(true);
    setWriteListener(undefined);
  });

  it('a throwing listener never breaks the write', async () => {
    setWriteListener(() => {
      throw new Error('rule bug');
    });
    const t = await taskRepo.create({ listId: 'inbox', title: 'safe' } as never);
    setWriteListener(undefined);
    expect(await taskRepo.get(t.id)).toBeDefined();
  });

  it('system tables are not events', () => {
    expect(splitTable('_settings')).toBeUndefined();
    expect(splitTable('todos_task')).toEqual({ moduleId: 'todos', collection: 'task' });
    expect(eventsOf({ table: '_meta', kind: 'created', id: 'x' }, 0)).toEqual([]);
  });

  it('the vault produces no events', () => {
    expect(
      eventsOf({ table: 'accounts_entry', kind: 'created', id: 'x', data: { title: 'secret' } }, 0),
    ).toEqual([]);
  });

  it('a module can add derived events (e.g. completed)', () => {
    const out = eventsOf(
      {
        table: 'todos_task',
        kind: 'updated',
        id: 't1',
        data: { done: true },
        before: { done: false },
      },
      5,
      (s, base) =>
        s.before?.done === false && s.data?.done === true
          ? [{ ...base, type: 'todos.task.completed', key: `completed:${s.id}` }]
          : [],
    );
    expect(out.map((e) => e.type)).toEqual(['todos.task.updated', 'todos.task.completed']);
  });
});

describe('many events', () => {
  const { manifests, known } = ctxFor();
  const rules: Rule[] = Array.from({ length: 12 }, (_, i) => ({
    id: `r${i}`,
    title: `rule ${i}`,
    trigger: { kind: 'event', type: `mod${i}.thing.created` },
    conditions: [{ field: 'n', op: 'gt', value: 1_000_000 }],
    actions: [{ kind: 'notice', title: 'x' }],
    limitPerHour: 3,
  }));
  const deps: EngineDeps = {
    rules: async () => rules,
    settings: async () => ({ enabled: true, dryRun: false, globalPerHour: 0 }),
    manifests: () => manifests,
    known: () => known,
    database: db,
  };

  beforeEach(async () => {
    useFixedClock();
    for (const t of ['_meta', '_automationLog']) await db.table(t).clear();
    resetGuardCache();
  });

  it('handles 10 000 events against 12 rules quickly when nothing matches', async () => {
    const started = performance.now();
    for (let i = 0; i < 10_000; i++) {
      const e: AutomationEvent = {
        type: `mod${i % 12}.thing.created`,
        key: `k${i}`,
        at: 0,
        data: { n: i },
      };
      await processEvent(e, deps);
    }
    const ms = performance.now() - started;
    expect(ms).toBeLessThan(5_000);
    expect(await listLog(5, db)).toHaveLength(0);
    expect(await listNotices(db)).toHaveLength(0);
  });

  it('a flood of matching events is cut by the limits, not written one by one', async () => {
    const flood: Rule = { ...rules[0]!, id: 'flood', conditions: [], limitPerHour: 3 };
    const d = { ...deps, rules: async () => [flood] };
    const started = performance.now();
    for (let i = 0; i < 2_000; i++) {
      await processEvent({ type: 'mod0.thing.created', key: `f${i}`, at: 0, data: {} }, d);
    }
    expect(performance.now() - started).toBeLessThan(10_000);
    expect(await listNotices(db)).toHaveLength(3);
    expect((await listLog(50, db)).filter((l) => l.result === 'skipped')).toHaveLength(1);
  });
});
