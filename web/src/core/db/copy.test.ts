import { describe, expect, it } from 'vitest';
import { copyData } from './copy';

describe('copyData', () => {
  it('keeps the user data and drops the sync envelope', () => {
    const stored = {
      id: 'x',
      createdAt: 1,
      updatedAt: 2,
      deviceId: 'd',
      deletedAt: null,
      _f: { title: 'h' },
      title: 'Miete',
      amountMinor: 95000,
      note: undefined,
    };
    expect(copyData(stored)).toEqual({ title: 'Miete', amountMinor: 95000, note: undefined });
    expect(Object.keys(copyData(stored))).not.toContain('id');
  });
});
