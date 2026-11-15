import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { today } from '@/core/time/dates';
import { stepsOf } from '../logic';
import { routineRepo } from '../repo';
import start, { addRequested } from '../services';

describe('routine.requested (a checklist becomes a routine)', () => {
  beforeEach(async () => {
    await db.table('routines_routine').clear();
  });

  it('adds the name with the lines as steps, weekly from today', async () => {
    const id = await addRequested({
      name: ' Morgenroutine ',
      steps: ['Wasser trinken', '', 'Zähne putzen'],
    });
    const r = await routineRepo.get(id!);
    expect(r).toMatchObject({ name: 'Morgenroutine', dueDate: today() });
    expect(r!.repeat).toMatchObject({ freq: 'weekly', interval: 1 });
    expect(stepsOf(r!).map((s) => s.text)).toEqual(['Wasser trinken', 'Zähne putzen']);
  });

  it('asking twice (any capitals) never makes two; an empty name makes none', async () => {
    await addRequested({ name: 'Morgenroutine', steps: ['A'] });
    expect(await addRequested({ name: 'MORGENROUTINE', steps: ['B'] })).toBeUndefined();
    expect(await addRequested({ name: '  ', steps: ['B'] })).toBeUndefined();
    expect(await routineRepo.active().count()).toBe(1);
  });

  it('the service listens on the bus while the module runs', async () => {
    const stop = start();
    await bus.emit('routine.requested', { name: 'Abendroutine', steps: ['Zähne putzen'] });
    await expect.poll(() => routineRepo.active().count()).toBe(1);
    stop();
  });
});
