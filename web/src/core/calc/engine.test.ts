import { describe, expect, it, vi } from 'vitest';
import { CalcError } from './expr';
import { evaluateExpression, localize } from './engine';

const ev = async (s: string, o?: Parameters<typeof evaluateExpression>[1]) =>
  (await evaluateExpression(s, o)).canonical;
const code = async (s: string) => {
  try {
    await evaluateExpression(s);
  } catch (e) {
    return e instanceof CalcError ? e.code : `other:${String(e)}`;
  }
  return 'no error';
};

describe('floating point traps', () => {
  it.each([
    ['0,1 + 0,2', '0.3'],
    ['0.1 + 0.2', '0.3'],
    ['0,1 * 3', '0.3'],
    ['1.1 * 1.1', '1.21'],
    ['4,35 * 100', '435'],
    ['1,005 * 1000', '1005'],
    ['0,3 - 0,1', '0.2'],
    ['9,95 * 3', '29.85'],
    ['1 / 3', '0.333333333333333'],
    ['2 / 3', '0.666666666666667'],
  ])('%s = %s', async (input, expected) => {
    expect(await ev(input)).toBe(expected);
  });
});

describe('large numbers and rounding', () => {
  it('keeps 15 significant digits and exact integers', async () => {
    expect(await ev('123456789 * 987654321')).toBe('121932631112635000');
    expect(await ev('2^53 + 1')).toBe('9007199254740990');
    expect(await ev('10^20')).toBe('100000000000000000000');
    expect(await ev('10^30')).toBe('1e+30');
    expect(await ev('1e-10')).toBe('1e-10');
  });
  it('rounds results, not intermediate steps', async () => {
    expect(await ev('sqrt(2) * sqrt(2)')).toBe('2');
    expect(await ev('round(2,5)')).toBe('3');
    expect(await ev('round(1,2345; 2)')).toBe('1.23');
    expect(await ev('floor(-1,5)')).toBe('-2');
  });
});

describe('operator precedence', () => {
  it.each([
    ['2 + 3 * 4', '14'],
    ['(2 + 3) * 4', '20'],
    ['-2^2', '-4'],
    ['2^3^2', '512'],
    ['10 - 2 - 3', '5'],
    ['100 / 10 / 2', '5'],
    ['2 * 3 + 4 * 5', '26'],
    ['2 × 3 − 1', '5'],
    ['12 ÷ 4 + 1', '4'],
    ['12 : 4', '3'],
    ['5!', '120'],
    ['2 pi', '6.28318530717959'],
  ])('%s = %s', async (input, expected) => {
    expect(await ev(input)).toBe(expected);
  });
});

describe('percent', () => {
  it('a ± b% is relative to a, otherwise b/100', async () => {
    expect(await ev('240 + 19%')).toBe('285.6');
    expect(await ev('240 - 25%')).toBe('180');
    expect(await ev('240 * 19%')).toBe('45.6');
  });
});

describe('scientific functions', () => {
  it('trigonometry in degrees and radians', async () => {
    expect(await ev('sin(30)', { angle: 'deg' })).toBe('0.5');
    expect(await ev('cos(60)', { angle: 'deg' })).toBe('0.5');
    expect(await ev('tan(45)', { angle: 'deg' })).toBe('1');
    expect(await ev('asin(0,5)', { angle: 'deg' })).toBe('30');
    expect(await ev('sin(pi / 6)', { angle: 'rad' })).toBe('0.5');
    expect(await ev('sin(30 deg)', { angle: 'rad' })).toBe('0.5');
  });
  it('logarithms, roots, powers, constants', async () => {
    expect(await ev('log10(1000)')).toBe('3');
    expect(await ev('log(100; 10)')).toBe('2');
    expect(await ev('ln(e)')).toBe('1');
    expect(await ev('sqrt(16) + cbrt(27)')).toBe('7');
    expect(await ev('√16')).toBe('4');
    expect(await ev('nthRoot(16; 4)')).toBe('2');
    expect(await ev('2^10')).toBe('1024');
    expect(await ev('3²')).toBe('9');
    expect(await ev('pi')).toBe('3.14159265358979');
    expect(await ev('π')).toBe('3.14159265358979');
  });
});

describe('variables and ans', () => {
  it('keeps variables and ans between calls', async () => {
    const vars = new Map<string, unknown>();
    expect(await ev('a = 19%', { vars })).toBe('0.19');
    expect(await ev('200 + a', { vars })).toBe('200.19');
    expect(await ev('ans * 2', { vars })).toBe('400.38');
    expect(await ev('240 + a * 100%', { vars })).toBe('240.19');
  });
  it('does not leak the degree wrappers into the variables', async () => {
    const vars = new Map<string, unknown>();
    await ev('sin(30)', { angle: 'deg', vars });
    expect([...vars.keys()]).toEqual(['ans']);
  });
});

describe('number bases', () => {
  it('reads hex, binary and octal literals and bit operations', async () => {
    expect(await ev('0x1F + 1')).toBe('32');
    expect(await ev('0b101')).toBe('5');
    expect(await ev('0o17')).toBe('15');
    expect(await ev('3 & 5')).toBe('1');
    expect(await ev('3 | 5')).toBe('7');
    expect(await ev('5 << 2')).toBe('20');
    expect(await ev('bitXor(5; 3)')).toBe('6');
  });
});

describe('units', () => {
  it('converts with "to"', async () => {
    expect(await ev('12 cm to inch')).toMatch(/^4\.7244\d* inch$/);
  });
});

describe('locale input', () => {
  it('accepts both marks', async () => {
    expect(await ev('1.234,56 + 1')).toBe('1235.56');
    expect(await ev('1,234.56 + 1')).toBe('1235.56');
    expect(await ev('12,5 * 2')).toBe('25');
    expect(await ev('12.5 * 2')).toBe('25');
  });
  it('localises the output with grouping', () => {
    expect(localize('1234567.5')).toBe('1.234.567,5');
    expect(localize('-1234')).toBe('-1.234');
    expect(localize('5 inch')).toBe('5 inch');
    expect(localize('12345678901234567890')).toBe('12.345.678.901.234.567.890');
  });
});

describe('errors', () => {
  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['2 +', 'syntax'],
    ['(1 + 2', 'syntax'],
    ['1 2 3', 'syntax'],
    ['1.2.3,4,5', 'syntax'],
    ['1 / 0', 'divide-by-zero'],
    ['foo + 1', 'unknown'],
    ['sqrt(-1) > 0', 'syntax'],
    ['2 cm + 3 kg', 'unit'],
    ['sin', 'syntax'],
    ['10000000!', 'range'],
    ['a'.repeat(300), 'syntax'],
  ])('%j → %s', async (input, expected) => {
    expect(await code(input)).toBe(expected);
  });
});

describe('lock-down', () => {
  it.each([
    'import({a: 1})',
    'evaluate("1+1")',
    'parse("1+1")',
    'createUnit("foo")',
    'range(1; 1000000000)',
    'zeros(100000)',
    '[1, 2, 3]',
    'simplify("x+x")',
    'random()',
    'constructor',
    '(1).constructor',
    'cos.constructor("return 1")()',
  ])('refuses %s', async (input) => {
    const c = await code(input);
    expect(c).not.toBe('no error');
    expect(c.startsWith('other:')).toBe(false);
  });
});

describe('plot functions', () => {
  it('compile once and give NaN where there is no real value', async () => {
    const { compilePlotFunction } = await import('./engine');
    const sq = await compilePlotFunction('x^2 - 3');
    expect(sq(2)).toBe(1);
    expect(sq(0)).toBe(-3);
    const root = await compilePlotFunction('sqrt(x)');
    expect(root(4)).toBe(2);
    expect(root(-4)).toBeNaN(); // complex → no real value
    const inv = await compilePlotFunction('1 / x');
    expect(inv(0)).toBe(Number.POSITIVE_INFINITY);
    expect(inv(4)).toBe(0.25);
  });
  it('uses degrees or radians for the trigonometry', async () => {
    const { compilePlotFunction } = await import('./engine');
    expect((await compilePlotFunction('sin(x)', 'deg'))(30)).toBeCloseTo(0.5, 12);
    expect((await compilePlotFunction('sin(x)', 'rad'))(Math.PI / 6)).toBeCloseTo(0.5, 12);
    expect((await compilePlotFunction('asin(x)', 'deg'))(0.5)).toBeCloseTo(30, 10);
  });
  it('reads locale input and the usual symbols', async () => {
    const { compilePlotFunction } = await import('./engine');
    expect((await compilePlotFunction('2,5 × x'))(2)).toBe(5);
    expect((await compilePlotFunction('x²'))(3)).toBe(9);
    expect((await compilePlotFunction('2π'))(0)).toBeCloseTo(Math.PI * 2, 12);
  });
  it('reports what is wrong with typed errors', async () => {
    const { compilePlotFunction } = await import('./engine');
    const code = async (s: string) => {
      try {
        await compilePlotFunction(s);
      } catch (e) {
        return e instanceof CalcError ? e.code : `other:${String(e)}`;
      }
      return 'no error';
    };
    expect(await code('')).toBe('empty');
    expect(await code('sin(')).toBe('syntax');
    expect(await code('foo(x)')).toBe('unknown');
    expect(await code('y + 1')).toBe('unknown');
    expect(await code('x!')).toBe('range');
    expect(await code('gamma(x)')).toBe('range');
  });
  it('keeps the lock-down', async () => {
    const { compilePlotFunction } = await import('./engine');
    for (const s of [
      'import({a: 1})',
      'evaluate("1+1")',
      'range(1; 1000000)',
      'zeros(100000)',
      '[1, 2]',
      'cos.constructor("return 1")()',
    ]) {
      let failed: boolean;
      try {
        const f = await compilePlotFunction(s);
        failed = Number.isNaN(f(1));
      } catch {
        failed = true;
      }
      expect(failed, s).toBe(true);
    }
  });
});

describe('plot functions without the library', () => {
  it('say so (offline) instead of pretending the input is wrong', async () => {
    vi.resetModules();
    vi.doMock('mathjs', () => {
      throw new Error('offline');
    });
    const fresh = await import('./engine');
    const { CalcError: FreshError } = await import('./expr');
    await expect(fresh.compilePlotFunction('sin(x)')).rejects.toMatchObject({ code: 'offline' });
    await expect(fresh.compilePlotFunction('sin(x)')).rejects.toBeInstanceOf(FreshError);
    vi.doUnmock('mathjs');
    vi.resetModules();
  });
});
