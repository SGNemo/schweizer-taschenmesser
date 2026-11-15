import { describe, expect, it } from 'vitest';
import { kindMeta } from '../components/Tabs';

describe('kindMeta', () => {
  it('names the kind when the name says something else', () => {
    expect(kindMeta({ name: 'Haushalt', kind: 'checking' })).toBe('Girokonto');
  });
  it('leaves the kind out when the name already says it', () => {
    expect(kindMeta({ name: 'Girokonto', kind: 'checking' })).toBeUndefined();
    expect(kindMeta({ name: ' bargeld ', kind: 'cash' })).toBeUndefined();
  });
  it('has no meta without a kind', () => {
    expect(kindMeta({ name: 'Konto', kind: undefined })).toBeUndefined();
  });
});
