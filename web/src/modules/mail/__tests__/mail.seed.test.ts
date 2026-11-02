import { describe, expect, it } from 'vitest';
import { createSeedContext } from '@/core/seed/context';
import { SEED_SCALES } from '@/core/seed/types';
import manifest from '../manifest';
import { bodySchema, threadSchema } from '../schema';
import seedModule from '../seed';

describe('mail seed', () => {
  it.each(SEED_SCALES)('is deterministic, valid and uses only invented addresses (%s)', (scale) => {
    const make = () =>
      seedModule.seed(createSeedContext({ moduleId: manifest.id, today: '2026-09-29', scale }));
    const rows = make();
    expect(JSON.stringify(rows)).toBe(JSON.stringify(make()));
    expect(rows.thread!.length).toBeGreaterThan(0);
    expect(rows.body!.length).toBe(rows.thread!.length);
    for (const row of rows.thread!) expect(threadSchema.safeParse(row.data).success).toBe(true);
    for (const row of rows.body!) expect(bodySchema.safeParse(row.data).success).toBe(true);
    const emails = JSON.stringify(rows).match(/[\w.+-]+@[\w.-]+/g) ?? [];
    expect(emails.length).toBeGreaterThan(0);
    for (const e of emails) expect(e.endsWith('example.org')).toBe(true);
  });
});
