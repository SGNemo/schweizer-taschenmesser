// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import source from '../plannable';
import { routineRepo } from '../repo';

const TODAY = '2026-09-29';
const weekly = { freq: 'weekly' as const, interval: 1 };

beforeEach(async () => {
  setNow(() => new Date(`${TODAY}T10:00:00`).getTime());
  await db.table('routines_routine').clear();
});

const add = (name: string, dueDate: string, people: string[] = []) =>
  routineRepo.create({ name, repeat: weekly, startDate: dueDate, dueDate, people, turn: 0 });

describe('routines as a source of the planner', () => {
  it('offers what is due until the horizon, one item per turn, with a soft date and never before today', async () => {
    await add('Bad putzen', '2026-09-20', ['Mia', 'Ben']);
    await add('Flur wischen', '2026-10-02');
    await add('Fenster putzen', '2026-11-30');
    const items = await source.list({ today: TODAY, until: '2026-10-06' });
    expect(items.map((i) => i.title).sort()).toEqual(['Bad putzen (Mia)', 'Flur wischen']);
    const bad = items.find((i) => i.title.startsWith('Bad'))!;
    expect(bad.id.endsWith(':2026-09-20')).toBe(true);
    // A routine that waited is offered for today: no date in the past, nothing "hard".
    expect(bad.earliest).toBe(TODAY);
    expect(bad.due).toEqual({ date: TODAY, hard: false });
    expect(items.find((i) => i.title === 'Flur wischen')!.earliest).toBe('2026-10-02');
  });

  it('ticked in the plan is "Erledigt": next day, next name; a turn that is already over is left alone', async () => {
    await add('Bad putzen', '2026-09-22', ['Mia', 'Ben']);
    const [item] = await source.list({ today: TODAY, until: TODAY });
    await source.onDone!(item!.id);
    const [after] = await routineRepo.active().toArray();
    expect(after).toMatchObject({ dueDate: '2026-10-06', turn: 1, lastDoneBy: 'Mia' });
    // The same (old) item again, as a late tick from another view would send it.
    await source.onDone!(item!.id);
    expect((await routineRepo.active().toArray())[0]).toMatchObject({
      dueDate: '2026-10-06',
      turn: 1,
    });
  });

  it("an edited estimate is kept as the routine's minutes", async () => {
    await add('Bad putzen', TODAY);
    const [item] = await source.list({ today: TODAY, until: TODAY });
    await source.onEstimate!(item!.id, 25.4);
    expect((await routineRepo.active().toArray())[0]!.minutes).toBe(25);
  });
});
