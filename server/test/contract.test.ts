import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FieldOp } from '../src/store.js';
import { pull, push, setup } from './helpers.js';

interface Case {
  name: string;
  batches: FieldOp[][];
  expected: Record<string, Record<string, { hlc: string; value: unknown }>>;
}

const { cases } = JSON.parse(
  readFileSync(new URL('../../contract/lww-cases.json', import.meta.url), 'utf8'),
) as { cases: Case[] };

/** Final state per "collection/id" → field, reconstructed from what a client would pull. */
async function finalState(batches: FieldOp[][]) {
  const { app, store } = await setup();
  for (const batch of batches) await push(app, batch);
  const state: Record<string, Record<string, { hlc: string; value: unknown }>> = {};
  for (const o of (await pull(app)).body.ops) {
    (state[`${o.collection}/${o.id}`] ??= {})[o.field] = { hlc: o.hlc, value: o.value };
  }
  await app.close();
  store.close();
  return state;
}

describe('LWW contract (shared with the web client)', () => {
  it('has cases', () => expect(cases.length).toBeGreaterThan(5));

  for (const c of cases) {
    it(c.name, async () => {
      expect(await finalState(c.batches)).toEqual(c.expected);
      // Arrival order must not matter.
      expect(await finalState([...c.batches].reverse().map((b) => [...b].reverse()))).toEqual(
        c.expected,
      );
    });
  }
});
