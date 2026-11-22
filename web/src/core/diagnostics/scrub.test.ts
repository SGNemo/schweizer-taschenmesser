import { describe, expect, it } from 'vitest';
import { sanitize, scrub } from './errorLog';

// Windows user folders may contain spaces, and network paths name machines and shares: neither may reach
// a bug report. (Own file: `diagnostics.test.ts` is a protected guard and stays as it is.)
describe('scrub: Windows user folders and network paths', () => {
  it('hides a user folder with spaces and a network path', () => {
    const out = sanitize(
      'open C:\\Users\\Erika Musterfrau\\Documents\\Steuer 2026.pdf failed, also \\\\nas-keller\\privat\\x.txt',
    );
    expect(out).not.toContain('Musterfrau');
    expect(out).not.toContain('Erika');
    expect(out).not.toContain('nas-keller');
    expect(out).not.toContain('privat');
    expect(out).toContain('failed');
  });

  it('hides a user folder with spaces at the very end of a message', () => {
    const out = sanitize('cannot open C:\\Users\\Erika Musterfrau');
    expect(out).not.toContain('Musterfrau');
    expect(out).toContain('cannot open');
  });

  it('hides it at the end of a line inside a longer text', () => {
    const out = scrub('open C:\\Users\\Erika Musterfrau\nCaused by: x');
    expect(out).not.toContain('Musterfrau');
    expect(out).toContain('Caused by: x');
  });
});
