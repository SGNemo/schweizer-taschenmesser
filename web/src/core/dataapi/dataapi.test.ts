import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { commitImport, undoImport } from '@/core/importer/batches';
import { buildPreview } from '@/core/importer/plan';
import { allManifests, getManifest, visibleManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { buildExample } from './example';
import { describeCollection, itemJsonSchema } from './format';
import { createJsonRuntime } from './importer';
import { importersOf } from './onboarding';
import { buildOpenApi } from './openapi';
import { ImportJsonError } from './parse';
import { apiCollections, apiModules, isDataApiModule } from './scope';
import { buildAiSchemaText } from './text';

const modules = visibleManifests.filter(isDataApiModule);

async function run(moduleId: string, json: unknown, batchId = 'b1') {
  const manifest = getManifest(moduleId)!;
  const runtime = createJsonRuntime(manifest);
  const text = typeof json === 'string' ? json : JSON.stringify(json);
  const parsed = await runtime.parse(
    'json',
    { kind: 'json', text },
    { today: '2026-09-29', options: {}, batchId },
  );
  const rows = await buildPreview(manifest, runtime, parsed.candidates);
  return { manifest, rows };
}

beforeEach(async () => {
  setNow(() => new Date(2026, 8, 29, 10, 0).getTime());
  for (const m of allManifests) {
    for (const c of Object.keys(m.dataSchema.collections)) await db.table(`${m.id}_${c}`).clear();
  }
  await db.table('_imports').clear();
  await db.table('_outbox').clear();
});
afterEach(() => setNow());

describe('scope', () => {
  it('never offers the password vault, local caches or connector collections', () => {
    const accounts = getManifest('accounts')!;
    expect(isDataApiModule(accounts)).toBe(false);
    expect(apiCollections(accounts)).toEqual([]);
    expect(importersOf(accounts)).toEqual([]);
    // Retired modules are closed to the API, whatever their collections hold.
    for (const m of allManifests.filter((x) => x.retired))
      expect(apiCollections(m), m.id).toEqual([]);
    expect(apiCollections(getManifest('calendar')!)).toEqual(['event']);
  });

  it('a manifest cannot lift the hard block on accounts', () => {
    const forged = { ...getManifest('accounts')!, dataApi: undefined };
    expect(isDataApiModule(forged)).toBe(false);
  });

  it('only switched-on modules appear', () => {
    const names = apiModules(allManifests, { todos: true, notes: false, accounts: true }).map(
      (m) => m.id,
    );
    expect(names).toEqual(['todos']);
  });
});

describe('format', () => {
  it('turns cents into euro, finds references and hides technical fields', () => {
    const tx = describeCollection(getManifest('finance')!, 'transaction');
    expect(tx.fields.find((f) => f.name === 'amount')).toMatchObject({
      kind: 'money',
      storeName: 'amountMinor',
    });
    expect(tx.fields.find((f) => f.name === 'accountId')).toMatchObject({
      kind: 'ref',
      refCollection: 'account',
    });
    const task = describeCollection(getManifest('todos')!, 'task');
    expect(task.fields.map((f) => f.name)).not.toContain('order');
    expect(task.fields.find((f) => f.name === 'parentId')?.refCollection).toBe('task');
  });

  it.each(modules.map((m) => [m.id, m] as const))(
    '%s: schema, text and examples are generated',
    (_id, m) => {
      for (const c of apiCollections(m)) {
        const schema = itemJsonSchema(describeCollection(m, c));
        expect(JSON.stringify(schema)).not.toContain('Minor');
      }
      expect(buildExample(m).length).toBe(apiCollections(m).length);
      expect(buildAiSchemaText(m)).toContain('Beispiel');
    },
  );

  it('the OpenAPI document covers the given modules only', () => {
    const doc = buildOpenApi([getManifest('todos')!, getManifest('finance')!]);
    const text = JSON.stringify(doc);
    expect(doc.openapi).toBe('3.1.0');
    expect(text).toContain('todos.task');
    expect(text).not.toContain('accounts');
    expect(text).not.toContain('Tresor');
  });
});

describe('examples are valid', () => {
  it.each(modules.map((m) => [m.id, m] as const))('%s', async (id, m) => {
    const { rows } = await run(id, { items: buildExample(m) });
    expect(rows.map((r) => r.invalid)).toEqual(rows.map(() => undefined));
    expect(rows.every((r) => r.selected)).toBe(true);
  });
});

describe('parsing', () => {
  it('reports each bad entry without echoing values and keeps the good ones', async () => {
    const { rows } = await run('finance', [
      { collection: 'account', name: 'Girokonto' },
      { collection: 'category', name: 'Essen', kind: 'geheimwort' },
      {
        collection: 'transaction',
        accountId: 'Girokonto',
        kind: 'expense',
        amount: 12.345,
        date: '2026-9-1',
      },
      { collection: 'nope' },
      { name: 'x', id: 'abc', collection: 'account' },
    ]);
    expect(rows[0]!.invalid).toBeUndefined();
    expect(rows[1]!.invalid).toContain('kind');
    expect(rows[2]!.invalid).toContain('amount');
    expect(rows[3]!.invalid).toBeDefined();
    expect(rows[4]!.invalid).toContain('id');
    for (const r of rows.slice(1)) expect(r.invalid).not.toContain('geheimwort');
  });

  it('rejects text that is not JSON or not a list', async () => {
    await expect(run('todos', 'nope')).rejects.toBeInstanceOf(ImportJsonError);
    await expect(run('todos', '{"a":1}')).rejects.toBeInstanceOf(ImportJsonError);
  });

  it('resolves references by @key, by title and by stored id; unknown ones are entry errors', async () => {
    const { rows } = await run('finance', [
      { collection: 'account', key: 'k', name: 'Konto A' },
      { collection: 'category', name: 'Essen', kind: 'expense' },
      {
        collection: 'transaction',
        accountId: '@k',
        categoryId: 'Essen',
        kind: 'expense',
        amount: '12,50',
        date: '2026-09-01',
      },
      {
        collection: 'transaction',
        accountId: 'Gibt es nicht',
        kind: 'expense',
        amount: 1,
        date: '2026-09-01',
      },
    ]);
    expect(rows[2]!.invalid).toBeUndefined();
    expect(rows[2]!.candidate.data).toMatchObject({
      amountMinor: 1250,
      accountId: rows[0]!.candidate.id,
    });
    expect(rows[3]!.invalid).toContain('accountId');
  });

  it('fills the default list for tasks without one', async () => {
    const { rows } = await run('todos', [{ collection: 'task', title: 'Milch kaufen' }]);
    expect(rows[0]!.invalid).toBeUndefined();
    expect(rows[0]!.candidate.data.listId).toBe('inbox');
  });
});

describe('duplicates, commit and undo', () => {
  it('the same data twice creates nothing new; undo removes the batch', async () => {
    const payload = [
      { collection: 'list', key: 'l', name: 'Haushalt' },
      {
        collection: 'task',
        listId: '@l',
        title: 'Fenster putzen',
        dueDate: '2026-10-01',
        priority: 2,
      },
    ];
    const first = await run('todos', payload, 'one');
    expect(first.rows.every((r) => r.selected)).toBe(true);
    const batch = await commitImport(first.manifest, {
      batchId: 'one',
      importerId: 'json',
      source: 'x',
      rows: first.rows,
    });
    expect(await db.table('_outbox').count()).toBeGreaterThanOrEqual(2);

    const second = await run('todos', payload, 'two');
    expect(second.rows.map((r) => r.duplicate)).toEqual([true, true]);
    expect(second.rows.some((r) => r.selected)).toBe(false);

    const undone = await undoImport(first.manifest, batch.id);
    expect(undone.removed).toBe(2);
    const third = await run('todos', payload, 'three');
    expect(third.rows.every((r) => !r.duplicate)).toBe(true);
  });

  it('a repeated entry inside one sending is flagged', async () => {
    const { rows } = await run('shopping', [{ name: 'Brot' }, { name: ' brot ' }]);
    expect(rows.map((r) => r.duplicate)).toEqual([false, true]);
  });
});
