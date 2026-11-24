// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import target from '../linkTarget';
import source from '../plannable';
import { routineRepo } from '../repo';

/** Planner hub 2, 10a (CONCEPT §1.3): a routine is a link target; its turns in the plan name it as `entityId`. */
const TODAY = '2026-09-29';
const add = (name: string, dueDate: string) =>
  routineRepo.create({
    name,
    repeat: { freq: 'weekly', interval: 1 },
    startDate: dueDate,
    dueDate,
    people: [],
    turn: 0,
  });

beforeEach(async () => {
  setNow(() => new Date(`${TODAY}T10:00:00`).getTime());
  await db.table('routines_routine').clear();
});

describe('routines as a link target', () => {
  it('alive: its name and route, no `done` (a routine comes back)', async () => {
    const r = await add('Bad putzen', '2026-09-30');
    expect(await target.resolve(r.id)).toEqual({
      state: 'alive',
      title: 'Bad putzen',
      to: `/routines?open=${r.id}`,
    });
  });

  it('a turn in the plan names the routine; the turn key itself resolves to nothing', async () => {
    const r = await add('Bad putzen', '2026-09-30');
    const [row] = await source.list({ today: TODAY, until: '2026-10-06' });
    expect(row).toMatchObject({ id: `${r.id}:2026-09-30`, entityId: r.id });
    expect(await target.resolve(row!.id)).toEqual({ state: 'gone' });
  });

  it('gone: soft-deleted, never here, malformed', async () => {
    const r = await add('Bad putzen', '2026-09-30');
    await routineRepo.remove(r.id);
    expect(await target.resolve(r.id)).toEqual({ state: 'gone' });
    for (const id of ['nope', '']) expect(await target.resolve(id)).toEqual({ state: 'gone' });
  });
});
