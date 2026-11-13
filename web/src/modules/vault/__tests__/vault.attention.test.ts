// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { addDaysStr } from '@/core/time/dates';
import source from '../attention';
import { documentRepo } from '../repo';

const TODAY = '2026-09-29';
/** A contract whose last day to cancel is `days` from today (30 days of notice before the end). */
const contract = (title: string, days: number) =>
  documentRepo.create({
    title,
    category: 'contract',
    endDate: addDaysStr(TODAY, days + 30),
    noticeDays: 30,
  } as never);

describe('vault attention: a deadline that ends today is an entry of its own', () => {
  beforeEach(async () => {
    await db.table('vault_document').clear();
  });

  it('vault:act-today carries due and the accent; the deadlines of the next seven days wait in one calm entry', async () => {
    await contract('Handyvertrag Anna', 0);
    await contract('Stromvertrag', 3);
    await contract('Fitnessstudio', 7);
    const items = await source({ today: TODAY });
    expect(items.map((i) => [i.id, i.tone, i.due, i.title])).toEqual([
      ['vault:act-today', 'accent', 'today', '1 Kündigungsfrist endet heute'],
      ['vault:act', 'warning', undefined, '2 Kündigungsfristen laufen bald ab'],
    ]);
  });

  it('no entry for today when no deadline ends today, and none for the week when all end today', async () => {
    await contract('Stromvertrag', 3);
    expect((await source({ today: TODAY })).map((i) => i.id)).toEqual(['vault:act']);
    await db.table('vault_document').clear();
    await contract('Handyvertrag Anna', 0);
    await contract('Hausrat', 0);
    const items = await source({ today: TODAY });
    expect(items.map((i) => [i.id, i.title])).toEqual([
      ['vault:act-today', '2 Kündigungsfristen enden heute'],
    ]);
  });

  it('never carries a document title, and no entry is covered by a block that lists titles', async () => {
    await contract('Handyvertrag Anna', 0);
    await contract('Stromvertrag', 3);
    await documentRepo.create({
      title: 'Reisepass Anna',
      category: 'identity',
      endDate: addDaysStr(TODAY, -5),
    } as never);
    const items = await source({ today: TODAY });
    expect(JSON.stringify(items)).not.toMatch(/Anna|Handyvertrag|Stromvertrag|Reisepass/);
    expect(items.every((i) => i.to === '/vault' && i.coveredBy === undefined)).toBe(true);
    // Expired stays the calm tone: red is for overdue money and exceeded budgets.
    expect(items.find((i) => i.id === 'vault:expired')?.tone).toBe('warning');
  });
});
