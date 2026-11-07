import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FieldOp } from '../src/store.js';
import { pull, push, setup } from './helpers.js';

type Expect = Record<string, unknown>;
type Step =
  | { push: FieldOp[]; expect: Expect }
  | { pushGenerated: number; expect: Expect }
  | { pull: { since: number; limit: number }; expect: Expect }
  | { reset: true; expect: Expect };
interface Case {
  name: string;
  level: 'store' | 'handler';
  steps: Step[];
}

const { cases } = JSON.parse(
  readFileSync(new URL('../../contract/sync-paging-cases.json', import.meta.url), 'utf8'),
) as { cases: Case[] };

const generated = (n: number): FieldOp[] =>
  Array.from({ length: n }, (_, i) => ({
    collection: 'todos_task',
    id: `g${i}`,
    field: 'title',
    hlc: `0000000001000-${String(i).padStart(4, '0')}-aaaa0001`,
    value: i,
  }));

/** Abstract contract errors → what this server answers. */
const errors: Record<string, { status: number; error?: string }> = {
  'hlc-drift': { status: 400, error: 'hlc-drift' },
  'too-many-ops': { status: 400 },
  'limit-too-large': { status: 400 },
};

describe('sync paging contract (Node server)', () => {
  it('has cases of both levels', () => {
    expect(cases.some((c) => c.level === 'store')).toBe(true);
    expect(cases.some((c) => c.level === 'handler')).toBe(true);
  });

  for (const c of cases) {
    it(c.name, async () => {
      const { app, store } = await setup();
      let epoch = store.epoch();
      const checkEpoch = (want: unknown, seen: string) => {
        if (want === 'same') expect(seen).toBe(epoch);
        if (want === 'changed') expect(seen).not.toBe(epoch);
        epoch = seen;
      };

      for (const step of c.steps) {
        const want = step.expect;
        if ('push' in step || 'pushGenerated' in step) {
          const ops = 'push' in step ? step.push : generated(step.pushGenerated);
          const res = await push(app, ops);
          if (typeof want.error === 'string') {
            const e = errors[want.error]!;
            expect(res.status).toBe(e.status);
            if (e.error) expect(res.body).toMatchObject({ error: e.error });
          } else {
            expect(res.status).toBe(200);
            expect(res.body.accepted).toBe(want.accepted);
            expect(res.body.cursor).toBe(want.cursor);
            checkEpoch(want.epoch, res.body.epoch);
          }
        } else if ('pull' in step) {
          const res = await pull(app, step.pull.since, step.pull.limit);
          if (typeof want.error === 'string') {
            expect(res.status).toBe(errors[want.error]!.status);
          } else {
            expect(res.status).toBe(200);
            if (want.ops) expect(res.body.ops).toEqual(want.ops);
            if (want.count !== undefined) expect(res.body.ops).toHaveLength(want.count as number);
            expect(res.body.cursor).toBe(want.cursor);
            expect(res.body.more).toBe(want.more);
          }
        } else {
          checkEpoch(want.epoch, store.reset());
        }
      }
      await app.close();
      store.close();
    });
  }
});
