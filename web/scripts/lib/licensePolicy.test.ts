import { describe, expect, it } from 'vitest';
import { checkLicense } from './licensePolicy';

describe('licence allowlist', () => {
  it.each([
    'MIT',
    'Apache-2.0',
    'MIT OR Apache-2.0',
    'MIT/Apache-2.0',
    'Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT',
    '(MIT AND Zlib)',
    '(Apache-2.0 OR MIT) AND BSD-3-Clause',
    'OFL-1.1',
    'Unicode-3.0',
    'MIT OR Apache-2.0 OR LGPL-2.1-or-later', // copyleft only as one choice
  ])('allows %s', (expr) => {
    expect(checkLicense(expr)).toEqual({ ok: true, rejected: [] });
  });

  it.each([
    ['GPL-3.0-only', ['GPL-3.0']],
    ['AGPL-3.0-or-later', ['AGPL-3.0']],
    ['LGPL-2.1-or-later', ['LGPL-2.1']],
    ['MIT AND GPL-2.0-only', ['GPL-2.0']],
    ['GPL-2.0-only OR LGPL-3.0-only', ['GPL-2.0', 'LGPL-3.0']],
    ['UNKNOWN', ['UNKNOWN']],
    ['', ['(none)']],
    ['SEE LICENSE IN LICENSE.txt', ['SEE LICENSE IN LICENSE.txt']],
    ['Some-Custom-Licence', ['Some-Custom-Licence']],
    ['MIT OR', ['MIT OR']],
  ])('rejects %j', (expr, rejected) => {
    expect(checkLicense(expr)).toEqual({ ok: false, rejected });
  });
});
