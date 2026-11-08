import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('A10 (round 5): the start-up never fills the Dev-Preview by itself', () => {
  it('core/startup.ts does not call the seed runner', () => {
    const src = readFileSync(new URL('./startup.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/autoFillIfEmpty|loadSeed/);
  });
});
