import { describe, expect, it } from 'vitest';
import { flipCoin, pickLine, randomBetween, rollDice } from './logic';

describe('dice tools', () => {
  it('rolls within range and sums', () => {
    for (let i = 0; i < 200; i++) {
      const r = rollDice(3, 6)!;
      expect(r.rolls).toHaveLength(3);
      expect(r.rolls.every((n) => n >= 1 && n <= 6)).toBe(true);
      expect(r.total).toBe(r.rolls.reduce((a, b) => a + b, 0));
    }
  });
  it('rejects bad dice', () => {
    expect(rollDice(0, 6)).toBeUndefined();
    expect(rollDice(1, 1)).toBeUndefined();
    expect(rollDice(1.5, 6)).toBeUndefined();
  });
  it('flips both sides eventually', () => {
    const seen = new Set(Array.from({ length: 100 }, flipCoin));
    expect(seen).toEqual(new Set(['heads', 'tails']));
  });
  it('draws numbers inside the bounds incl. negatives', () => {
    for (let i = 0; i < 200; i++) {
      const n = randomBetween(-3, 3)!;
      expect(n >= -3 && n <= 3).toBe(true);
    }
    expect(randomBetween(5, 5)).toBe(5);
    expect(randomBetween(5, 4)).toBeUndefined();
  });
  it('picks a non-empty line', () => {
    expect(pickLine('  \n\n a \n')).toBe('a');
    expect(pickLine('  \n')).toBeUndefined();
    expect(['x', 'y']).toContain(pickLine('x\ny'));
  });
});
