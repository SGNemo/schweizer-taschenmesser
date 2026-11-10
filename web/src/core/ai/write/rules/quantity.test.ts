import { describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { visibleManifests } from '@/core/modules/registry';
import { parseWrite } from './parse';

/** A bare number for an action that maps `roles.quantity` to a number field (Fitness: kcal of a meal). */
const manifests = visibleManifests.filter((m) => m.id !== 'example');
const now = new Date(2026, 8, 29, 10, 0);
const meal = async (input: string) => {
  const p = await parseWrite(input, { manifests, database: db, now, today: '2026-09-29' });
  return p?.ops[0];
};

describe('rules: bare quantity', () => {
  it('reads the one number left as the kcal of a meal', async () => {
    expect(await meal('Mahlzeit Döner 650 kcal')).toMatchObject({
      action: 'createMeal',
      data: { text: 'Döner', kcal: 650 },
    });
  });

  it('never takes a clock time or a distance in time', async () => {
    const op = await meal('Mahlzeit gestern 12 Uhr Döner 650');
    expect(op?.data).toMatchObject({ kcal: 650 });
    expect((await meal('Mahlzeit vor 2 Tagen Pizza 800'))?.data).toMatchObject({ kcal: 800 });
  });

  it('does not guess between two numbers', async () => {
    const op = await meal('Mahlzeit 2 Brötchen 300 kcal');
    expect(op?.data?.kcal).toBeUndefined();
  });
});
