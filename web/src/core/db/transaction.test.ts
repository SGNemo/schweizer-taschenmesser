import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { TaschenmesserDB } from './db';
import { createRepo, transaction } from './repo';
import { createTestDb } from '@/test-utils';

const schema = z.object({ title: z.string(), n: z.number().default(0) });

let db: TaschenmesserDB;
beforeEach(() => {
  db = createTestDb();
});
afterEach(async () => {
  db.close();
  await db.delete();
});

// Two real collections of the test database stand in for two modules.
const entries = () =>
  createRepo('example_entry', schema as never, db) as unknown as {
    name: string;
    create(data: { title: string }, opts?: { id?: string }): Promise<{ id: string }>;
    update(id: string, patch: Record<string, unknown>): Promise<unknown>;
    get(id: string): Promise<unknown>;
    table: { count(): Promise<number> };
  };

describe('transaction()', () => {
  it('commits all writes of the callback together, outbox included', async () => {
    const repo = entries();
    await transaction(
      [repo],
      async () => {
        await repo.create({ title: 'a' }, { id: 'a' });
        await repo.create({ title: 'b' }, { id: 'b' });
        await repo.update('a', { title: 'a2' });
      },
      db,
    );
    expect(await repo.table.count()).toBe(2);
    expect(await db.table('_outbox').count()).toBe(2);
  });

  it('rolls everything back when the callback throws half way', async () => {
    const repo = entries();
    await expect(
      transaction(
        [repo],
        async () => {
          await repo.create({ title: 'a' }, { id: 'a' });
          await repo.create({ title: 'b' }, { id: 'b' });
          throw new Error('crash');
        },
        db,
      ),
    ).rejects.toThrow('crash');
    expect(await repo.table.count()).toBe(0);
    expect(await db.table('_outbox').count()).toBe(0);
  });

  it('works on the first write of a fresh database (the device id is read before it starts)', async () => {
    const repo = entries();
    expect(await db.table('_meta').count()).toBe(0);
    await transaction(
      [repo],
      async () => {
        await repo.create({ title: 'first' }, { id: 'first' });
      },
      db,
    );
    expect(await repo.get('first')).toMatchObject({ title: 'first' });
  });
});
