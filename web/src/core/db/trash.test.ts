import { describe, expect, it } from 'vitest';
import { isLiveOrRestorable, isRestorable, TRASH_RETENTION_MS } from './trash';

const NOW = 1_800_000_000_000;

describe('trash window', () => {
  it('a record deleted less than 30 days ago is restorable', () => {
    expect(isRestorable(NOW - 1000, NOW)).toBe(true);
    expect(isRestorable(NOW - TRASH_RETENTION_MS + 1, NOW)).toBe(true);
  });

  it('an older or not deleted record is not', () => {
    expect(isRestorable(NOW - TRASH_RETENTION_MS, NOW)).toBe(false);
    expect(isRestorable(null, NOW)).toBe(false);
    expect(isRestorable(undefined, NOW)).toBe(false);
  });

  it('live records and restorable tombstones keep their extras', () => {
    expect(isLiveOrRestorable(null, NOW)).toBe(true);
    expect(isLiveOrRestorable(NOW - 1000, NOW)).toBe(true);
    expect(isLiveOrRestorable(NOW - TRASH_RETENTION_MS - 1, NOW)).toBe(false);
  });
});
