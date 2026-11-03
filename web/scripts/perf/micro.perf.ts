/**
 * Micro-benchmarks of the data logic on synthetic input (manual tooling, `npm run measure:micro`;
 * numbers in docs/perf/DATA-BASELINE-*.md). IndexedDB is fake-indexeddb here, so only compare
 * numbers with each other, never with the browser measurements of `npm run measure:data`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { db } from '@/core/db/db';
import { searchEntries } from '@/core/ai/search/fulltext';
import { ctxFor, TODAY } from '@/core/ai/testing';
import { balances } from '@/modules/finance/logic';
import { createRepo, type Repo } from '@/core/db/repo';
import { allManifests } from '@/core/modules/registry';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { runSync } from '@/core/sync/engine';
import { MemoryServer } from '@/core/sync/testing';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const round = (n: number) => Math.round(n * 10) / 10;

async function time(fn: () => unknown | Promise<unknown>, runs = 3): Promise<number> {
  const out: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    out.push(performance.now() - t0);
  }
  return round(median(out));
}

const OUT = process.env.DATA_OUT ?? 'node_modules/.cache/perf-data';
const LABEL = process.env.DATA_LABEL ?? 'run';
const results: Record<string, unknown> = {};
function save(key: string, value: unknown) {
  results[key] = value;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${LABEL}-micro.json`, JSON.stringify(results, null, 2));
}

const envelope = (i: number) => ({
  id: `perf-${i}`,
  createdAt: 1,
  updatedAt: 1,
  deviceId: 'd',
  deletedAt: null,
  _f: {},
});
const WORDS = ['Tankstelle', 'Arzt', 'Miete', 'Supermarkt', 'Strom', 'Kino', 'Bahn', 'Apotheke'];

describe('data micro-benchmarks', () => {
  it('finance balances() with n bookings in one account', async () => {
    const accounts = [{ id: 'a1', openingBalanceMinor: 0 }];
    const rows: Record<string, number> = {};
    for (const n of [1_000, 5_000, 20_000, 50_000]) {
      const txs = Array.from({ length: n }, (_, i) => ({
        ...envelope(i),
        accountId: 'a1',
        kind: i % 5 === 0 ? ('income' as const) : ('expense' as const),
        amountMinor: 100 + (i % 977),
        date: `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows[`${n} bookings`] = await time(() => balances(accounts, txs as any, '2026-12-31'), 1);
    }
    save('balances', rows);
  });

  it('full-text search (searchEntries) over 20k bookings, 5k events, 2k notes, 2k tasks', async () => {
    const tx = Array.from({ length: 20_000 }, (_, i) => ({
      ...envelope(i),
      accountId: 'a1',
      kind: 'expense',
      amountMinor: 100,
      date: '2026-09-01',
      payee: `${WORDS[i % WORDS.length]} ${i % 300}`,
      note: i % 3 === 0 ? 'Einkauf' : '',
    }));
    const events = Array.from({ length: 5_000 }, (_, i) => ({
      ...envelope(i),
      title: `${WORDS[i % WORDS.length]} Termin ${i}`,
      startDate: '2026-09-02',
      allDay: true,
      location: i % 4 === 0 ? 'Musterstadt' : '',
      note: '',
    }));
    const notes = Array.from({ length: 2_000 }, (_, i) => ({
      ...envelope(i),
      title: `Notiz ${i} ${WORDS[i % WORDS.length]}`,
      body: `${WORDS.join(' ')} `.repeat(60),
      pinned: false,
    }));
    const tasks = Array.from({ length: 2_000 }, (_, i) => ({
      ...envelope(i),
      listId: 'inbox',
      title: `Aufgabe ${i} ${WORDS[i % WORDS.length]}`,
      note: '',
      done: false,
    }));
    await db.table('finance_transaction').bulkPut(tx);
    await db.table('calendar_event').bulkPut(events);
    await db.table('notes_note').bulkPut(notes);
    await db.table('todos_task').bulkPut(tasks);
    const ctx = ctxFor(['finance', 'calendar', 'notes', 'todos'], TODAY);
    const out: Record<string, number> = {};
    for (const q of ['tankstelle', 'arzt', 'miete 12'])
      out[q] = await time(() => searchEntries(q, ctx));
    save('searchEntries', out);
  });

  it('sync: first push of n records from device A, first pull on a fresh device B', async () => {
    const example = allManifests.find((m) => m.id === 'example')!;
    const schema = example.dataSchema.collections.entry!.schema;
    let clock = 1_800_000_000_000;
    setNow(() => (clock += 1));
    const out: Record<string, unknown> = {};
    for (const n of [2_000, 10_000]) {
      const server = new MemoryServer();
      const a = createTestDb();
      const b = createTestDb();
      const repoA = createRepo('example_entry', schema, a) as unknown as Repo<{
        title: string;
        done: boolean;
      }>;
      const items = Array.from({ length: n }, (_, i) => ({
        data: { title: `Eintrag ${i}`, done: i % 2 === 0 },
      }));
      const w0 = performance.now();
      await repoA.createMany(items);
      const writeMs = performance.now() - w0;
      const push0 = performance.now();
      await runSync({ storage: new DexieStorageAdapter(a), adapter: server.adapter() });
      const pushMs = performance.now() - push0;
      const pull0 = performance.now();
      await runSync({ storage: new DexieStorageAdapter(b), adapter: server.adapter() });
      const pullMs = performance.now() - pull0;
      out[`${n} records`] = {
        createManyMs: round(writeMs),
        firstPushMs: round(pushMs),
        firstPullMs: round(pullMs),
        pushRequests: server.requests.push,
        pullRequests: server.requests.pull,
      };
      a.close();
      b.close();
      await a.delete();
      await b.delete();
    }
    setNow();
    save('sync', out);
  });
});
