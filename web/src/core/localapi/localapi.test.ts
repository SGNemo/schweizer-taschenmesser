import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { enableModule } from '@/core/modules/activation';
import { allManifests, getManifest, visibleManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { listRepo, taskRepo } from '@/modules/todos/repo';
import {
  createToken,
  hashToken,
  isExpired,
  loadConfig,
  revokeToken,
  serverTokens,
  updateConfig,
  type Grant,
} from './config';
import { handleRequest, MAX_PENDING, type ApiRequest } from './handler';
import { appendLog, lastUsed, loadLog, LOG_SIZE } from './log';

const T0 = new Date(2026, 8, 29, 10, 0).getTime();
const manifests = allManifests;
let nextId = 1;

async function token(grants: Record<string, Grant>, expiresInDays: number | null = 90) {
  return (await createToken({ name: 'Claude', grants, expiresInDays, autoCommit: false })).entry;
}

function call(tokenId: string, method: string, path: string, extra: Partial<ApiRequest> = {}) {
  return handleRequest({ id: nextId++, tokenId, method, path, query: '', ...extra }, { manifests });
}

beforeEach(async () => {
  setNow(() => T0);
  for (const m of allManifests) {
    for (const c of Object.keys(m.dataSchema.collections)) await db.table(`${m.id}_${c}`).clear();
  }
  for (const table of ['_meta', '_modules', '_imports', '_outbox']) await db.table(table).clear();
  await updateConfig({ enabled: true });
  await listRepo.create({ name: 'Eingang', order: 0 }, { id: 'inbox' });
});
afterEach(() => setNow());

describe('tokens', () => {
  it('stores only a hash; the plain token is returned once', async () => {
    const { token: plain, entry } = await createToken({
      name: 'KI',
      grants: { todos: { read: true, write: false }, notes: { read: false, write: false } },
      expiresInDays: 30,
      autoCommit: false,
    });
    expect(plain).toMatch(/^tm_[A-Za-z0-9_-]{43}$/);
    expect(entry.hash).toBe(await hashToken(plain));
    const stored = JSON.stringify(await db.table('_meta').toArray());
    expect(stored).not.toContain(plain);
    expect(entry.grants).toEqual({ todos: { read: true, write: false } }); // empty grants dropped
    expect(entry.expiresAt).toBe(T0 + 30 * 86_400_000);
    expect(serverTokens(await loadConfig())).toEqual([
      { id: entry.id, hash: entry.hash, expiresAt: entry.expiresAt },
    ]);
  });

  it('expires and can be revoked', async () => {
    const entry = await token({ todos: { read: true, write: true } }, 1);
    expect(isExpired(entry, T0)).toBe(false);
    expect(isExpired(entry, T0 + 86_400_000)).toBe(true);
    await revokeToken(entry.id);
    expect((await loadConfig()).tokens).toEqual([]);
  });

  it('is off by default with the default port', async () => {
    await db.table('_meta').clear();
    const config = await loadConfig();
    expect(config).toEqual({ enabled: false, port: 47631, tokens: [] });
  });
});

describe('handler: access', () => {
  it('refuses when switched off, for unknown, revoked or expired tokens', async () => {
    const entry = await token({ todos: { read: true, write: true } }, 1);
    expect((await call('nope', 'GET', '/v1/modules')).status).toBe(401);
    setNow(() => T0 + 2 * 86_400_000);
    expect((await call(entry.id, 'GET', '/v1/modules')).status).toBe(401);
    setNow(() => T0);
    await revokeToken(entry.id);
    expect((await call(entry.id, 'GET', '/v1/modules')).status).toBe(401);
    const other = await token({ todos: { read: true, write: true } });
    await updateConfig({ enabled: false });
    expect((await call(other.id, 'GET', '/v1/modules')).status).toBe(503);
  });

  it('lists only granted, switched-on modules – never the password vault', async () => {
    await enableModule(getManifest('accounts')!);
    await enableModule(getManifest('notes')!);
    const entry = await token({
      todos: { read: true, write: false },
      accounts: { read: true, write: true },
      finance: { read: false, write: true },
      lists: { read: true, write: true }, // not switched on
    });
    const res = await call(entry.id, 'GET', '/v1/modules');
    expect(res.status).toBe(200);
    const body = res.body as { modules: { id: string; rights: Grant }[] };
    expect(body.modules.map((m) => m.id).sort()).toEqual(['finance', 'todos']);
    expect(body.modules.find((m) => m.id === 'finance')!.rights).toEqual({
      read: false,
      write: true,
    });
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/accounts|Tresor|Passwort/);

    const doc = JSON.stringify((await call(entry.id, 'GET', '/v1/openapi.json')).body);
    expect(doc).toContain('todos.task');
    expect(doc).not.toMatch(/accounts|Tresor|Passwort|notes\./);
  });

  it('blocked, unknown and system names all look the same', async () => {
    await enableModule(getManifest('accounts')!);
    const entry = await token({
      accounts: { read: true, write: true },
      todos: { read: true, write: true },
    });
    const accounts = await call(entry.id, 'GET', '/v1/accounts/items');
    const bogus = await call(entry.id, 'GET', '/v1/doesnotexist/items');
    expect(accounts.status).toBe(404);
    expect(accounts.body).toEqual(bogus.body);
    const write = await call(entry.id, 'POST', '/v1/accounts/import', { body: '{"items":[{}]}' });
    expect(write.status).toBe(404);
    for (const path of [
      '/v1/_secrets/items',
      '/v1/_meta/items',
      '/v1/settings/items',
      '/v1/_settings/items',
      '/v1/modules/items',
      '/v1/../_secrets/items',
    ]) {
      expect((await call(entry.id, 'GET', path)).status, path).toBe(404);
    }
  });

  it('needs the matching right', async () => {
    const entry = await token({
      todos: { read: false, write: true },
      finance: { read: true, write: false },
    });
    expect(
      (await call(entry.id, 'GET', '/v1/todos/items', { query: 'collection=task' })).status,
    ).toBe(403);
    expect(
      (await call(entry.id, 'POST', '/v1/finance/import', { query: 'dryRun=true', body: '[]' }))
        .status,
    ).toBe(403);
    expect(
      (await call(entry.id, 'GET', '/v1/finance/items', { query: 'collection=account' })).status,
    ).toBe(200);
  });

  it('writes an access log without content', async () => {
    const entry = await token({ todos: { read: true, write: true } });
    const secretTitle = 'Geheimprojekt Zebra';
    const res = await call(entry.id, 'POST', '/v1/todos/import', {
      query: 'dryRun=true',
      body: JSON.stringify([{ collection: 'task', title: secretTitle }]),
    });
    expect(res.status).toBe(200);
    expect(res.log).toMatchObject({
      token: 'Claude',
      tokenId: entry.id,
      method: 'POST',
      route: '/v1/{module}/import',
      module: 'todos',
      status: 200,
      count: 1,
    });
    expect(JSON.stringify(res.log)).not.toContain('Zebra');
    await appendLog(res.log);
    expect(lastUsed(await loadLog()).get(entry.id)).toBe(T0);
    for (let i = 0; i < LOG_SIZE + 5; i++) await appendLog(res.log);
    expect((await loadLog()).length).toBe(LOG_SIZE);
  });
});

describe('handler: reading', () => {
  it('pages through live entries in the import format', async () => {
    const entry = await token({
      finance: { read: true, write: false },
      todos: { read: true, write: false },
    });
    const finance = getManifest('finance')!;
    await enableModule(finance);
    const { transactionRepo, accountRepo } = await import('@/modules/finance/repo');
    await accountRepo.create({ name: 'Giro', openingBalanceMinor: 0, order: 0 }, { id: 'acc-x' });
    for (let i = 0; i < 3; i++) {
      await transactionRepo.create(
        { accountId: 'acc-x', kind: 'expense', amountMinor: 1250 + i, date: '2026-09-01' },
        { id: `tx-${i}` },
      );
    }
    await transactionRepo.remove('tx-1');

    const first = await call(entry.id, 'GET', '/v1/finance/items', {
      query: 'collection=transaction&limit=1',
    });
    const page1 = first.body as { items: Record<string, unknown>[]; nextCursor: string | null };
    expect(page1.items).toEqual([
      expect.objectContaining({
        id: 'tx-0',
        collection: 'transaction',
        amount: 12.5,
        accountId: 'acc-x',
      }),
    ]);
    expect(page1.items[0]).not.toHaveProperty('amountMinor');
    const second = await call(entry.id, 'GET', '/v1/finance/items', {
      query: `collection=transaction&limit=5&cursor=${page1.nextCursor}`,
    });
    const page2 = second.body as { items: { id: string }[]; nextCursor: string | null };
    expect(page2.items.map((i) => i.id)).toEqual(['tx-2']); // tx-1 is deleted
    expect(page2.nextCursor).toBeNull();

    expect((await call(entry.id, 'GET', '/v1/finance/items')).status).toBe(400); // collection needed
    expect(
      (
        await call(entry.id, 'GET', '/v1/finance/items', {
          query: 'collection=transaction&limit=999',
        })
      ).status,
    ).toBe(400);
    const search = await call(entry.id, 'GET', '/v1/todos/items', {
      query: 'collection=list&q=eing',
    });
    expect((search.body as { items: unknown[] }).items).toHaveLength(1);
  });
});

describe('handler: import check', () => {
  it('dryRun reports per entry and stores nothing', async () => {
    const entry = await token({ todos: { read: false, write: true } });
    await taskRepo.create({
      listId: 'inbox',
      title: 'Schon da',
      done: false,
      priority: 0,
      order: 0,
    });
    const before = await db.table('todos_task').count();
    const res = await call(entry.id, 'POST', '/v1/todos/import', {
      query: 'dryRun=true',
      body: JSON.stringify({
        items: [
          { collection: 'task', title: 'Neu', dueDate: '2026-10-01' },
          { collection: 'task', title: 'Schon da' },
          { collection: 'task', title: 'Kaputt', dueDate: 'morgen' },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = res.body as {
      summary: Record<string, number>;
      items: { status: string; errors?: string[] }[];
    };
    expect(body.summary).toEqual({ ok: 1, update: 0, duplicate: 1, invalid: 1 });
    expect(body.items.map((i) => i.status)).toEqual(['ok', 'duplicate', 'invalid']);
    expect(body.items[2]!.errors![0]).toContain('dueDate');
    expect(body.items[2]!.errors![0]).not.toContain('morgen');
    expect(await db.table('todos_task').count()).toBe(before);
    expect(await db.table('_imports').count()).toBe(0);
  });

  it('rejects bodies that are not an import', async () => {
    const entry = await token({ todos: { read: false, write: true } });
    const bad = await call(entry.id, 'POST', '/v1/todos/import', {
      query: 'dryRun=true',
      body: 'nope',
    });
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({ error: 'bad-body' });
  });
});

it('every visible data-API module can be described for a token', async () => {
  const grants = Object.fromEntries(
    visibleManifests.map((m) => [m.id, { read: true, write: true }]),
  );
  for (const m of visibleManifests) await enableModule(m);
  const entry = await token(grants);
  const res = await call(entry.id, 'GET', '/v1/modules');
  const ids = (res.body as { modules: { id: string }[] }).modules.map((m) => m.id);
  expect(ids).not.toContain('accounts');
  expect(ids).toContain('todos');
});

describe('handler: batches', () => {
  const tasks = (...titles: string[]) =>
    JSON.stringify({ items: titles.map((title) => ({ collection: 'task', title })) });
  const titles = async () => (await taskRepo.active().toArray()).map((x) => x.title).sort();

  it('an import waits for confirmation; the client cannot commit it without auto-commit', async () => {
    const entry = await token({ todos: { read: true, write: true } });
    const res = await call(entry.id, 'POST', '/v1/todos/import', { body: tasks('A', 'B') });
    expect(res.status).toBe(202);
    const body = res.body as { batchId: string; status: string; summary: Record<string, number> };
    expect(body.status).toBe('pending');
    expect(body.summary.ok).toBe(2);
    expect(await titles()).toEqual([]);

    const list = await call(entry.id, 'GET', '/v1/batches');
    expect((list.body as { batches: { batchId: string }[] }).batches.map((b) => b.batchId)).toEqual(
      [body.batchId],
    );
    const commit = await call(entry.id, 'POST', `/v1/batches/${body.batchId}/commit`);
    expect(commit.status).toBe(403);
    expect(commit.body).toMatchObject({ error: 'confirmation-required' });

    // The user confirms in the app.
    const { commitPendingBatch } = await import('@/core/dataapi/pending');
    await commitPendingBatch(getManifest('todos')!, body.batchId);
    expect(await titles()).toEqual(['A', 'B']);
    const detail = await call(entry.id, 'GET', `/v1/batches/${body.batchId}`);
    expect(detail.body).toMatchObject({ status: 'committed', written: 2 });
    expect(await db.table('_outbox').count()).toBeGreaterThanOrEqual(2);

    // Undo through the API.
    const undo = await call(entry.id, 'DELETE', `/v1/batches/${body.batchId}`);
    expect(undo.body).toMatchObject({ status: 'undone', removed: 2, kept: 0 });
    expect(await titles()).toEqual([]);
    const again = await call(entry.id, 'DELETE', `/v1/batches/${body.batchId}`);
    expect(again.body).toMatchObject({ status: 'undone' });
  });

  it('auto-commit tokens store new entries at once; undo still works', async () => {
    const { entry } = await createToken({
      name: 'Auto',
      grants: { todos: { read: false, write: true } },
      expiresInDays: 30,
      autoCommit: true,
    });
    const res = await call(entry.id, 'POST', '/v1/todos/import', { body: tasks('C') });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'committed', written: 1 });
    expect(await titles()).toEqual(['C']);
    const id = (res.body as { batchId: string }).batchId;
    await call(entry.id, 'DELETE', `/v1/batches/${id}`);
    expect(await titles()).toEqual([]);
  });

  it('a waiting batch can be rejected by the client', async () => {
    const entry = await token({ todos: { read: false, write: true } });
    const res = await call(entry.id, 'POST', '/v1/todos/import', { body: tasks('D') });
    const id = (res.body as { batchId: string }).batchId;
    const del = await call(entry.id, 'DELETE', `/v1/batches/${id}`);
    expect(del.body).toMatchObject({ status: 'rejected' });
    expect(await titles()).toEqual([]);
  });

  it('the same Idempotency-Key returns the same batch; another body conflicts', async () => {
    const entry = await token({ todos: { read: false, write: true } });
    const first = await call(entry.id, 'POST', '/v1/todos/import', {
      body: tasks('E'),
      idempotencyKey: 'k1',
    });
    const second = await call(entry.id, 'POST', '/v1/todos/import', {
      body: tasks('E'),
      idempotencyKey: 'k1',
    });
    expect(second.status).toBe(200);
    expect((second.body as { batchId: string }).batchId).toBe(
      (first.body as { batchId: string }).batchId,
    );
    expect(await db.table('_imports').count()).toBe(1);
    const other = await call(entry.id, 'POST', '/v1/todos/import', {
      body: tasks('F'),
      idempotencyKey: 'k1',
    });
    expect(other.status).toBe(409);
  });

  it('sending data that already exists creates nothing', async () => {
    const entry = await token({ todos: { read: false, write: true } });
    await taskRepo.create({ listId: 'inbox', title: 'G', done: false, priority: 0, order: 0 });
    const res = await call(entry.id, 'POST', '/v1/todos/import', { body: tasks('G') });
    expect(res.body).toMatchObject({ batchId: null, status: 'nothing' });
    expect(await db.table('_imports').count()).toBe(0);
  });

  it('limits the number of waiting imports per token', async () => {
    const entry = await token({ todos: { read: false, write: true } });
    for (let i = 0; i < MAX_PENDING; i++) {
      const res = await call(entry.id, 'POST', '/v1/todos/import', { body: tasks(`T${i}`) });
      expect(res.status).toBe(202);
    }
    const over = await call(entry.id, 'POST', '/v1/todos/import', { body: tasks('zu viel') });
    expect(over.status).toBe(429);
    expect(over.body).toMatchObject({ error: 'too-many-pending' });
    // A dry run still works.
    const dry = await call(entry.id, 'POST', '/v1/todos/import', {
      query: 'dryRun=true',
      body: tasks('zu viel'),
    });
    expect(dry.status).toBe(200);
  });

  it('batches of other tokens are invisible', async () => {
    const a = await token({ todos: { read: false, write: true } });
    const b = await token({ todos: { read: false, write: true } });
    const res = await call(a.id, 'POST', '/v1/todos/import', { body: tasks('H') });
    const id = (res.body as { batchId: string }).batchId;
    expect((await call(b.id, 'GET', `/v1/batches/${id}`)).status).toBe(404);
    expect((await call(b.id, 'DELETE', `/v1/batches/${id}`)).status).toBe(404);
    expect((await call(b.id, 'GET', '/v1/batches')).body).toEqual({ batches: [] });
  });

  it('changes of existing entries are shown as a diff and never auto-committed', async () => {
    const { entry } = await createToken({
      name: 'Auto',
      grants: { todos: { read: true, write: true } },
      expiresInDays: 30,
      autoCommit: true,
    });
    const task = await taskRepo.create({
      listId: 'inbox',
      title: 'Alt',
      done: false,
      priority: 0,
      order: 0,
    });
    const res = await call(entry.id, 'POST', '/v1/todos/import', {
      body: JSON.stringify([{ collection: 'task', id: task.id, title: 'Neu', priority: 2 }]),
    });
    expect(res.status).toBe(202);
    const body = res.body as { batchId: string; items: { status: string; changes: unknown }[] };
    expect(body.items[0]!.status).toBe('update');
    expect(body.items[0]!.changes).toEqual([
      { field: 'title', from: 'Alt', to: 'Neu' },
      { field: 'priority', from: '0', to: '2' },
    ]);
    expect((await call(entry.id, 'POST', `/v1/batches/${body.batchId}/commit`)).status).toBe(403);
    expect((await taskRepo.get(task.id))!.title).toBe('Alt');

    const { commitPendingBatch, getBatch, reviewRows } = await import('@/core/dataapi/pending');
    const todos = getManifest('todos')!;
    const rows = await reviewRows(todos, (await getBatch(body.batchId))!);
    expect(rows[0]!.selected).toBe(false); // never pre-ticked
    await commitPendingBatch(todos, body.batchId, [0]);
    expect(await taskRepo.get(task.id)).toMatchObject({ title: 'Neu', priority: 2 });

    await call(entry.id, 'DELETE', `/v1/batches/${body.batchId}`);
    expect(await taskRepo.get(task.id)).toMatchObject({ title: 'Alt', priority: 0 });
  });

  it('a change is skipped when the entry was edited meanwhile', async () => {
    const entry = await token({ todos: { read: true, write: true } });
    const task = await taskRepo.create({
      listId: 'inbox',
      title: 'X',
      done: false,
      priority: 0,
      order: 0,
    });
    const res = await call(entry.id, 'POST', '/v1/todos/import', {
      body: JSON.stringify([{ collection: 'task', id: task.id, title: 'Y' }]),
    });
    const id = (res.body as { batchId: string }).batchId;
    setNow(() => T0 + 1000);
    await taskRepo.update(task.id, { title: 'Von Hand' });
    const { commitPendingBatch } = await import('@/core/dataapi/pending');
    const done = await commitPendingBatch(getManifest('todos')!, id, [0]);
    expect(done.conflicts).toBe(1);
    expect((await taskRepo.get(task.id))!.title).toBe('Von Hand');
  });

  it('an id from another collection or module is not found', async () => {
    const entry = await token({ todos: { read: true, write: true } });
    const res = await call(entry.id, 'POST', '/v1/todos/import', {
      query: 'dryRun=true',
      body: JSON.stringify([{ collection: 'task', id: 'inbox', title: 'x' }]),
    });
    expect((res.body as { items: { status: string }[] }).items[0]!.status).toBe('invalid');
  });
});
