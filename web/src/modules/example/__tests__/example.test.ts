import { describe, expect, it } from 'vitest';
import { validateManifest } from '@/core/modules/registry';
import manifest from '../manifest';
import { entrySchema } from '../schema';

describe('example module', () => {
  it('has a valid manifest', () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  it('validates entries', () => {
    expect(entrySchema.safeParse({ title: '' }).success).toBe(false);
    expect(entrySchema.parse({ title: 'x' }).done).toBe(false);
  });
});
