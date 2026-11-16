import { describe, expect, it } from 'vitest';
import { returnRoute } from '../returnTo';

describe('returnRoute (`?from=` of the pay route, untrusted)', () => {
  it('names the planner for `plan`', () => {
    expect(returnRoute('plan')).toBe('/planner');
  });

  it('anything off the allow-list means „stay“: never a route of its own', () => {
    for (const value of [
      null,
      undefined,
      '',
      'PLAN',
      ' plan',
      'plan&x=1',
      '/planner',
      '//evil.example',
      'https://evil.example',
      'javascript:alert(1)',
      '__proto__',
      'constructor',
      'toString',
      'hasOwnProperty',
    ])
      expect(returnRoute(value)).toBeUndefined();
  });
});
