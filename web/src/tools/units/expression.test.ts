import { describe, expect, it } from 'vitest';
import { convertQuery } from './expression';

describe('unit expression', () => {
  it('converts to the usual units of the same kind', () => {
    const r = convertQuery('umrechnen 5 km')!;
    expect(r.text).toMatch(/^5 km = /);
    expect(r.text).toContain('5.000 m');
    expect(r.text.split(' · ')).toHaveLength(3);
  });

  it('knows temperature, aliases and a decimal comma', () => {
    expect(convertQuery('convert 100 c')!.text).toContain('212 f');
    expect(convertQuery('umrechnen 2,5 pfund')!.text).toMatch(/^2,5 lb = /);
    expect(convertQuery('umrechnen 50 km/h')!.text).toContain('mph');
  });

  it('copies a plain number without thousands separators', () => {
    expect(convertQuery('umrechnen 5 km')!.copy).toBe('5000');
  });

  it('ignores everything else', () => {
    for (const q of [
      'umrechnen',
      'umrechnen 5',
      'umrechnen 5 parsec',
      'km 5',
      '5 km',
      'convert x km',
    ])
      expect(convertQuery(q), q).toBeUndefined();
  });
});
