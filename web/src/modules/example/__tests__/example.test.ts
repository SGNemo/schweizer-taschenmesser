import { describe, expect, it } from 'vitest';
import { entrySchema } from '../schema';

describe('example module', () => {
  it('validates entries', () => {
    expect(entrySchema.safeParse({ title: '' }).success).toBe(false);
    expect(entrySchema.parse({ title: 'x' }).done).toBe(false);
  });
});
