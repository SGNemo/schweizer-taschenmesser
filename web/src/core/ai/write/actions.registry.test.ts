/**
 * Registry test: every action of every module runs its examples end to end – the free rule parser
 * reads the example sentence, the op is validated and previewed, committed, and undone again.
 * A module that adds `aiSchema.actions` is covered automatically.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { tableName } from '@/core/db/schema';
import { visibleManifests } from '@/core/modules/registry';
import type { AiActionDef, ModuleManifest } from '@/core/modules/types';
import { setNow } from '@/core/time/now';
import { aiModules } from '../scope';
import { TODAY, clearAll, useFixedClock } from '../testing';
import { commitOps, undoGroup } from './commit';
import { prepareOp } from './prepare';
import { parseWrite } from './rules/parse';
import type { ProposedOp } from './types';

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  await db.table('_imports').clear();
});
afterAll(() => setNow());

const NOW = new Date(2026, 8, 29, 10, 0);
const manifests = visibleManifests;
const ctx = () => ({ manifests, known: manifests, database: db, today: TODAY });
const rules = () => ({ manifests, database: db, now: NOW, today: TODAY });

const cases = aiModules(manifests).flatMap((m) =>
  Object.entries(m.aiSchema.actions ?? {}).flatMap(([id, def]) =>
    def.examples.map((example, n) => ({ m, id, def, example, name: `${m.id}.${id}#${n}` })),
  ),
);

/** Creates the entry a non-create example talks about, through the collection's own create example. */
async function ensureTarget(m: ModuleManifest, def: AiActionDef): Promise<void> {
  const create = Object.values(m.aiSchema!.actions!).find(
    (a) => a.kind === 'create' && a.collection === def.collection,
  );
  expect(create, `${m.id}.${def.collection} needs a create action for its examples`).toBeDefined();
  const example = create!.examples[0]!;
  const proposal = await parseWrite(example.input, rules());
  const prepared = await prepareOp(proposal!.ops[0]!, 0, ctx());
  const result = await commitOps([prepared], { manifests, source: 'test' });
  expect(result.written).toBe(1);
}

const count = async (m: ModuleManifest, collection: string): Promise<number> =>
  (await db.table(tableName(m.id, collection)).toArray()).filter((r) => r.deletedAt === null)
    .length;

describe('registry of AI actions', () => {
  it('has actions for the modules the assistant can write to', () => {
    const ids = aiModules(manifests)
      .filter((m) => m.aiSchema.actions)
      .map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'todos',
        'calendar',
        'finance',
        'invoices',
        'subscriptions',
        'lists',
        'notes',
      ]),
    );
  });

  it('never gives the password vault or the disk module actions', () => {
    for (const id of ['accounts', 'disk']) {
      const m = manifests.find((x) => x.id === id);
      if (m) expect(m.aiSchema?.actions).toBeUndefined();
    }
  });

  describe.each(cases)('$name', ({ m, id, def, example }) => {
    it('rules read the example sentence into this action', async () => {
      if (def.kind !== 'create') await ensureTarget(m, def);
      const proposal = await parseWrite(example.input, rules());
      expect(proposal, example.input).toBeDefined();
      const op = proposal!.ops[0]!;
      expect([op.module, op.action]).toEqual([m.id, id]);
      if (def.kind === 'create' || def.kind === 'update') {
        expect(op.data).toMatchObject(example.output);
      }
      if (def.kind !== 'create') {
        expect(op.target?.title?.toLowerCase()).toContain(
          example.target!.toLowerCase().split(' ')[0]!,
        );
      }
    });

    it('previews, commits and undoes', async () => {
      if (def.kind !== 'create') await ensureTarget(m, def);
      const before = await count(m, def.collection);
      const op: ProposedOp =
        def.kind === 'create'
          ? { module: m.id, action: id, data: example.output }
          : { module: m.id, action: id, data: example.output, target: { title: example.target! } };
      const prepared = await prepareOp(op, 0, ctx());
      expect(prepared.error).toBeUndefined();
      expect(prepared.missing).toEqual([]);
      expect(prepared.ready).toBe(true);
      if (def.kind !== 'create')
        expect(prepared.lines.length + (def.kind === 'delete' ? 1 : 0)).toBeGreaterThan(0);

      const result = await commitOps([prepared], { manifests, source: example.input });
      expect(result.written).toBe(1);
      const after = await count(m, def.collection);
      expect(after).toBe(
        def.kind === 'create' ? before + 1 : def.kind === 'delete' ? before - 1 : before,
      );

      const undone = await undoGroup(result.groupId, { manifests });
      expect(undone.kept).toBe(0);
      expect(await count(m, def.collection)).toBe(before);
    });
  });
});
