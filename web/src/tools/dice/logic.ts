import { randomInt } from '@/core/crypto/random';

export interface RollResult {
  rolls: number[];
  total: number;
}

export function rollDice(count: number, sides: number): RollResult | undefined {
  if (!Number.isInteger(count) || count < 1 || count > 100) return undefined;
  if (!Number.isInteger(sides) || sides < 2 || sides > 1000) return undefined;
  const rolls = Array.from({ length: count }, () => randomInt(sides) + 1);
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

export const flipCoin = (): 'heads' | 'tails' => (randomInt(2) === 0 ? 'heads' : 'tails');

/** Uniform integer in [min, max]. */
export function randomBetween(min: number, max: number): number | undefined {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) return undefined;
  const span = max - min + 1;
  if (span > 2 ** 32) return undefined;
  return min + randomInt(span);
}

/** One random non-empty line. */
export function pickLine(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines[randomInt(lines.length)] : undefined;
}
