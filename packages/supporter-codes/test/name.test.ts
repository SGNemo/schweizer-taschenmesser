import { describe, expect, it } from 'vitest';
import { sanitizeName } from '../src/name.ts';

describe('sanitizeName', () => {
  it('trims, collapses whitespace and keeps normal names', () => {
    expect(sanitizeName('  Sven   Müller ')).toBe('Sven Müller');
  });
  it('strips control, zero-width and bidi characters', () => {
    expect(sanitizeName('Sv\u200Ben\u202E\u0007')).toBe('Sv en');
    expect(sanitizeName('\u202Eevil')).toBe('evil');
  });
  it('limits to 20 code points without splitting emoji', () => {
    const out = sanitizeName('😀'.repeat(30));
    expect([...out]).toHaveLength(20);
  });
  it('normalises to NFC and returns empty for nothing usable', () => {
    expect(sanitizeName('e\u0301')).toBe('é');
    expect(sanitizeName(' \u200B\t ')).toBe('');
  });
  it('is idempotent', () => {
    const once = sanitizeName(' a\u200Bb  c ');
    expect(sanitizeName(once)).toBe(once);
  });
});
