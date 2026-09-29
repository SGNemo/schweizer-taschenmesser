import { describe, expect, it } from 'vitest';
import example from '@/modules/example/manifest';
import { buildStores, tableName } from './schema';

describe('buildStores', () => {
  it('derives prefixed tables with default indexes and system tables', () => {
    const stores = buildStores([example]);
    expect(stores[tableName('example', 'entry')]).toBe('id, updatedAt, createdAt');
    expect(stores._outbox).toBe('[collection+id], queuedAt');
  });

  it('is sorted (stable snapshot)', () => {
    const keys = Object.keys(buildStores([example]));
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
  });

  it('rejects invalid ids and collection names', () => {
    expect(() => buildStores([{ ...example, id: 'Bad_Id' }])).toThrow(/Invalid module id/);
    expect(() =>
      buildStores([
        {
          ...example,
          dataSchema: { collections: { 'bad-name': example.dataSchema.collections.entry! } },
        },
      ]),
    ).toThrow(/Invalid collection/);
  });
});
