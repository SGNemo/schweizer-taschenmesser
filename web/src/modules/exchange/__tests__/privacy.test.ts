import { describe, expect, it } from 'vitest';
import { BLOCKED_MODULES } from '@/core/dataapi/scope';
import manifest from '../manifest';

/** Device messages never reach the assistant, the search, the data API, a sync or a backup. */
describe('exchange privacy', () => {
  it('has no aiSchema, no data API and is blocked by id', () => {
    expect(manifest.aiSchema).toBeUndefined();
    expect(manifest.dataApi).toBe(false);
    expect(BLOCKED_MODULES).toContain('exchange');
  });

  it('keeps every collection device-local (never synced, never in a backup)', () => {
    for (const [name, c] of Object.entries(manifest.dataSchema.collections)) {
      expect(c.local, name).toBe(true);
      expect((c as { searchable?: unknown }).searchable, name).toBeUndefined();
    }
  });

  it('runs only where the home-network channel exists', () => {
    expect(manifest.platforms).toEqual(['desktop', 'android']);
  });
});
