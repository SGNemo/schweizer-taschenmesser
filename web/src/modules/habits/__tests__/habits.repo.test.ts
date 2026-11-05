import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { resetUndoJournal, undoable } from '@/core/undo';
import { bump, entryId, entryRepo, goalRepo } from '../repo';

beforeEach(async () => {
  resetUndoJournal();
  await db.table('habits_goal').clear();
  await db.table('habits_entry').clear();
});

describe('counting', () => {
  it('two quick "+1" taps count twice (the card does not wait for the first)', async () => {
    const g = await goalRepo.create({ name: 'Wasser', kind: 'count', target: 8, unit: 'Gläser' });
    const tap = () => undoable('Wasser', () => bump(g.id, '2026-11-05', 1));
    await Promise.all([tap(), tap()]);
    expect((await entryRepo.get(entryId(g.id, '2026-11-05')))?.count).toBe(2);
    await Promise.all([tap(), tap(), bump(g.id, '2026-11-05', -1)]);
    expect((await entryRepo.get(entryId(g.id, '2026-11-05')))?.count).toBe(3);
  });

  it('a failed bump does not block the next one', async () => {
    await expect(bump('g', 'kein-datum', 1)).rejects.toThrow();
    const g = await goalRepo.create({ name: 'Wasser', kind: 'count', target: 8, unit: 'Gläser' });
    await bump(g.id, '2026-11-05', 1);
    expect((await entryRepo.get(entryId(g.id, '2026-11-05')))?.count).toBe(1);
  });
});
