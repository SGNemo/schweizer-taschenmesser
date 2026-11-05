// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { addDaysStr, today } from '@/core/time/dates';
import source from '../calendar';
import { documentRepo } from '../repo';

describe('vault calendar items (C04)', () => {
  beforeEach(async () => {
    await db.table('vault_document').clear();
  });

  it('count documents per day and wording and never carry a document title', async () => {
    const end = addDaysStr(today(), 10);
    for (const title of ['Handyvertrag Anna', 'Stromvertrag'])
      await documentRepo.create({ title, category: 'contract', endDate: end } as never);
    const one = await documentRepo.create({
      title: 'Reisepass Anna',
      category: 'identity',
      endDate: end,
    } as never);
    const items = await source({ from: today(), to: addDaysStr(today(), 30) });
    expect(items.map((i) => i.title).sort()).toEqual([
      'Läuft ab: 1 Unterlage',
      'Vertragsende: 2 Unterlagen',
    ]);
    expect(JSON.stringify(items)).not.toMatch(/Anna|Handyvertrag|Stromvertrag|Reisepass/);
    expect(items.find((i) => i.title.startsWith('Läuft ab'))!.to).toBe(`/vault?open=${one.id}`);
    expect(items.find((i) => i.title.startsWith('Vertragsende'))!.to).toBe('/vault');
  });
});
