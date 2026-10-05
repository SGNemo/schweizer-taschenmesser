/**
 * Evaluation of stage 0 (rules) on `tests/ai/eval-set.json`: ≥ 150 invented German inputs over all
 * modules (create, change, delete, mark, several entries, typos, slang, relative dates, comma
 * amounts) plus negatives (searches and questions). `npm run ai:eval` prints the table; the normal
 * test run only guards the numbers. Later stages (local model) are measured with the same set.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import {
  EVAL_NOW,
  EVAL_TODAY,
  evalCases as cases,
  evalManifests as manifests,
  scoreProposal,
  seedEvalFixtures,
  type EvalCase as Case,
  type Outcome,
} from './evalSupport';
import { parseWrite } from './rules/parse';
import type { ProposedOp } from './types';

beforeAll(async () => {
  setNow(() => EVAL_NOW.getTime());
  await seedEvalFixtures();
});
afterAll(() => setNow());

async function run(c: Case): Promise<{ outcome: Outcome; got?: ProposedOp[] }> {
  const proposal = await parseWrite(c.input, {
    manifests,
    database: db,
    now: EVAL_NOW,
    today: EVAL_TODAY,
  });
  return { outcome: await scoreProposal(c, proposal), got: proposal?.ops };
}

describe('eval set', () => {
  it('has at least 150 invented inputs with negatives', () => {
    expect(cases.length).toBeGreaterThanOrEqual(150);
    expect(cases.filter((c) => c.expect.length === 0).length).toBeGreaterThanOrEqual(20);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    const modules = new Set(cases.flatMap((c) => c.expect.map((e) => e.module)));
    for (const m of manifests.filter((x) => Object.keys(x.aiSchema?.actions ?? {}).length > 0)) {
      expect(modules.has(m.id), `eval set covers ${m.id}`).toBe(true);
    }
  });

  it('stage 0 handles most inputs correctly and rarely gets one wrong', async () => {
    const results: { c: Case; outcome: Outcome; got?: ProposedOp[] }[] = [];
    for (const c of cases) results.push({ c, ...(await run(c)) });

    const count = (o: Outcome, f: (c: Case) => boolean = () => true) =>
      results.filter((r) => r.outcome === o && f(r.c)).length;
    const positives = results.filter((r) => r.c.expect.length > 0);
    const negatives = results.filter((r) => r.c.expect.length === 0);
    const exact = count('exact');
    const partial = count('partial');
    const wrong = count('wrong');
    const escalate = count('escalate');
    const falsePositives = count('false-positive');
    const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)} %`;

    if (process.env.AI_EVAL) {
      const lines = [
        '',
        `Stage 0 (rules, 0 tokens) on ${cases.length} inputs (${positives.length} entries, ${negatives.length} negatives)`,
        `  exact            ${exact}\t${pct(exact, positives.length)}`,
        `  module right, fields off  ${partial}\t${pct(partial, positives.length)}`,
        `  wrong module/action       ${wrong}\t${pct(wrong, positives.length)}`,
        `  passed on (stage 1/2)     ${escalate}\t${pct(escalate, positives.length)}`,
        `  negatives kept out        ${count('negative-ok')}/${negatives.length}  (false positives: ${falsePositives})`,
        '',
        'By kind:',
      ];
      for (const tag of [
        'create',
        'update',
        'delete',
        'transition',
        'multi',
        'typo',
        'slang',
        'relative-date',
        'hard',
      ]) {
        const sub = positives.filter((r) => r.c.tags.includes(tag));
        if (sub.length === 0) continue;
        const e = sub.filter((r) => r.outcome === 'exact').length;
        lines.push(`  ${tag.padEnd(14)} ${e}/${sub.length} exact`);
      }
      lines.push('', 'Not exact:');
      for (const r of results.filter((x) => !['exact', 'negative-ok'].includes(x.outcome))) {
        lines.push(
          `  [${r.outcome}] ${r.c.id}: ${JSON.stringify(r.c.input)} -> ${JSON.stringify(r.got ?? null)}`,
        );
      }
      process.stdout.write(`${lines.join('\n')}\n`);
    }

    // Guards (CI): the rules must stay useful and, above all, must not act wrongly.
    expect(falsePositives / negatives.length).toBeLessThanOrEqual(0.05);
    expect(wrong / positives.length).toBeLessThanOrEqual(0.03);
    expect(exact / positives.length).toBeGreaterThanOrEqual(0.5);
  });
});
