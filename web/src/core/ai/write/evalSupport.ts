/**
 * Shared by the evaluations of stage 0 (`eval.test.ts`) and of the local models
 * (`../local/eval.models.test.ts`): the invented eval set, its stored fixtures and the scoring of a
 * proposal against the expected ops. Test support only; not part of the app bundle.
 */
import evalSet from '../../../../tests/ai/eval-set.json';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { visibleManifests } from '@/core/modules/registry';
import { clearAll } from '../testing';
import { fold } from '../text';
import { prepareProposal } from './prepare';
import type { WriteProposal } from './types';

export interface ExpectedOp {
  module: string;
  action: string;
  data?: Record<string, unknown>;
  target?: string;
}

export interface EvalCase {
  id: string;
  input: string;
  tags: string[];
  expect: ExpectedOp[];
}

export type Outcome = 'exact' | 'partial' | 'wrong' | 'escalate' | 'negative-ok' | 'false-positive';

export const evalCases = evalSet.cases as EvalCase[];
export const evalManifests = visibleManifests.filter((m) => m.id !== 'example');
/** A Tuesday; the expected dates of the eval set are for this day. */
export const EVAL_NOW = new Date(2026, 8, 29, 10, 0);
export const EVAL_TODAY = evalSet.today;

const subset = (actual: unknown, expected: unknown): boolean => {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (Array.isArray(expected)) return JSON.stringify(actual) === JSON.stringify(expected);
  if (actual === null || typeof actual !== 'object') return false;
  return Object.entries(expected).every(([k, v]) =>
    subset((actual as Record<string, unknown>)[k], v),
  );
};

/** Empties the test database and stores the fixtures (the entries update/delete/mark talk about). */
export async function seedEvalFixtures(): Promise<void> {
  await clearAll();
  await db.table('_imports').clear();
  for (const f of evalSet.fixtures) {
    const manifest = evalManifests.find((m) => m.id === f.module)!;
    await createCollectionRepo(manifest, f.collection, db).create(
      f.data as Record<string, unknown>,
      'id' in f ? { id: f.id as string } : undefined,
    );
  }
}

/**
 * `exact`: right ops, right fields, right entry · `partial`: right modules/actions but fields or
 * entry off · `wrong`: other module/action or count · `escalate`: no proposal (the next stage decides)
 * · for searches/questions (no expected ops): `negative-ok` or `false-positive`.
 */
export async function scoreProposal(
  c: EvalCase,
  proposal: WriteProposal | undefined,
): Promise<Outcome> {
  if (c.expect.length === 0) return proposal ? 'false-positive' : 'negative-ok';
  if (!proposal) return 'escalate';
  const got = proposal.ops;
  if (
    got.length !== c.expect.length ||
    got.some((o, i) => o.module !== c.expect[i]!.module || o.action !== c.expect[i]!.action)
  ) {
    return 'wrong';
  }
  const ctx = { manifests: evalManifests, known: evalManifests, database: db, today: EVAL_TODAY };
  const prepared = await prepareProposal(got, ctx).catch(() => undefined);
  if (!prepared) return 'partial';
  const ok = c.expect.every((e, i) => {
    const p = prepared[i]!;
    const dataOk = subset(got[i]!.data ?? {}, e.data ?? {});
    const targetOk = e.target === undefined || fold(p.targetTitle ?? '') === fold(e.target);
    return dataOk && targetOk;
  });
  return ok ? 'exact' : 'partial';
}
