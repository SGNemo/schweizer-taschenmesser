import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { CaptureError, availableTypes, saveCapture } from './index';

const ON = { fitness: true };

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 8, 12, 0).getTime());
  await db.table('fitness_meal').clear();
  await db.table('fitness_session').clear();
});

describe('fitness capture targets', () => {
  it('are offered only while Fitness is on', () => {
    expect(availableTypes(ON)).toEqual(expect.arrayContaining(['meal', 'workout']));
    expect(availableTypes({ todos: true })).not.toContain('meal');
  });

  it('writes a meal and takes it back on undo', async () => {
    const saved = await saveCapture(
      'meal',
      { title: 'Döner', kcal: 650, time: '12:00' },
      { states: ON },
    );
    expect(await db.table('fitness_meal').toArray()).toEqual([
      expect.objectContaining({ text: 'Döner', kcal: 650, date: '2026-11-08', time: '12:00' }),
    ]);
    await saved.undo();
    expect((await db.table('fitness_meal').toArray())[0]!.deletedAt).not.toBeNull();
  });

  it('writes a session with its exercises', async () => {
    await saveCapture(
      'workout',
      {
        title: 'Bankdrücken',
        date: '2026-11-07',
        exercises: [{ name: 'Bankdrücken', sets: 3, reps: 8, weightKg: 60 }],
      },
      { states: ON },
    );
    expect(await db.table('fitness_session').toArray()).toEqual([
      expect.objectContaining({
        date: '2026-11-07',
        exercises: [{ name: 'Bankdrücken', sets: 3, reps: 8, weightKg: 60 }],
      }),
    ]);
  });

  it('refuses a meal without kcal and anything while Fitness is off', async () => {
    await expect(saveCapture('meal', { title: 'Döner' }, { states: ON })).rejects.toBeInstanceOf(
      CaptureError,
    );
    await expect(
      saveCapture('meal', { title: 'Döner', kcal: 650 }, { states: { fitness: false } }),
    ).rejects.toMatchObject({ code: 'module-off' });
  });
});
