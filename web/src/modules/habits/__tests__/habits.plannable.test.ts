/** Planner hub S4 / concept H1: a daily goal with „Zeit im Plan freihalten“ keeps its minutes free – blocks only. */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import manifest from '../manifest';
import { migrations } from '../migrations';
import source, { goalBlocks } from '../plannable';
import { entryRepo, goalRepo, setEntry } from '../repo';
import { goalSchema } from '../schema';

// 2026-11-09 is a Monday.
const MON = '2026-11-09';
const SUN = '2026-11-15';
const goal = (over: object = {}) =>
  goalSchema.parse({ name: 'Spazieren gehen', minutes: 30, ...over });

beforeEach(async () => {
  await db.table('habits_goal').clear();
  await db.table('habits_entry').clear();
});

describe('goalBlocks', () => {
  it('blocks the scheduled days only, labelled with the typed name and nothing else', () => {
    const blocks = goalBlocks([{ id: 'g1', ...goal({ weekdays: [1, 3] }) }], [], MON, SUN);
    expect(blocks).toEqual([
      { date: MON, id: `g1:${MON}`, label: 'Spazieren gehen', min: 30 },
      { date: '2026-11-11', id: 'g1:2026-11-11', label: 'Spazieren gehen', min: 30 },
    ]);
  });

  it('no value, a weekly goal, an archived goal or a rest day never block', () => {
    const goals = [
      { id: 'none', ...goal({ minutes: undefined }) },
      { id: 'week', ...goal({ period: 'week' }) },
      { id: 'old', ...goal({ archived: true }) },
      { id: 'walk', ...goal() },
    ];
    const blocks = goalBlocks(
      goals,
      [{ goalId: 'walk', date: MON, skipped: true }],
      MON,
      '2026-11-10',
    );
    expect(blocks.map((b) => b.id)).toEqual(['walk:2026-11-10']);
  });

  it('a day already done still keeps its time: the plan never asks whether it was done', () => {
    expect(
      goalBlocks([{ id: 'g', ...goal() }], [{ goalId: 'g', date: MON }], MON, MON),
    ).toHaveLength(1);
  });
});

describe('the source', () => {
  it('lists nothing to plan or tick, and hands the blocks from the stored goals', async () => {
    const walk = await goalRepo.create(goal());
    await goalRepo.create(goal({ name: 'Wasser', minutes: undefined }));
    await setEntry(walk.id, MON, { skipped: true });
    expect(await source.list({ today: MON, until: SUN })).toEqual([]);
    const blocks = await source.blocks!({ today: MON, until: '2026-11-10' });
    expect(blocks).toEqual([
      { date: '2026-11-10', id: `${walk.id}:2026-11-10`, label: 'Spazieren gehen', min: 30 },
    ]);
    // The rest day lifted: Monday blocks again.
    await entryRepo.update(`${walk.id}:${MON}`, { skipped: undefined });
    expect(await source.blocks!({ today: MON, until: MON })).toHaveLength(1);
  });

  it('the field is additive: version 2 with an empty step, old goals parse unchanged', async () => {
    expect(manifest.version).toBe(2);
    expect(migrations?.[2]).toBeTypeOf('function');
    expect(goalSchema.parse({ name: 'Alt' }).minutes).toBeUndefined();
    expect(goalSchema.safeParse({ name: 'x', minutes: 4 }).success).toBe(false);
    expect(goalSchema.safeParse({ name: 'x', minutes: 241 }).success).toBe(false);
    expect(manifest.contributions?.plannable).toBeDefined();
  });
});
