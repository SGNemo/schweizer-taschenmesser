/**
 * The only sanctioned write path for synchronised records. Every write
 *  - validates against the collection's Zod schema,
 *  - stamps changed fields with an HLC (field-level last-write-wins),
 *  - keeps soft-delete tombstones instead of removing rows,
 *  - queues the record in the outbox for the sync layer.
 */
import type { Collection, Table } from 'dexie';
import type { z } from 'zod';
import { now } from '@/core/time/now';
import { db as defaultDb, type TaschenmesserDB } from './db';
import { getDeviceContext, type DeviceContext } from './device';
import { maxHlc } from './hlc';
import { ENVELOPE_KEYS, type Stored } from './types';
import { deepEqual, randomId } from './util';

type ReadTable<T> = Pick<
  Table<T, string>,
  'get' | 'where' | 'orderBy' | 'toCollection' | 'count' | 'filter' | 'toArray' | 'bulkGet'
>;

export interface Repo<T> {
  readonly name: string;
  /** Read-only view of the underlying table. Includes tombstones – prefer `active()`. */
  readonly table: ReadTable<Stored<T>>;
  /** All live (non-deleted) records. */
  active(): Collection<Stored<T>, string>;
  /** A live record, or undefined if missing / deleted. */
  get(id: string): Promise<Stored<T> | undefined>;
  create(data: T, opts?: { id?: string }): Promise<Stored<T>>;
  /**
   * Creates many records in ONE transaction (bulk imports). Each item may carry a fixed id; an id that
   * already exists (also as a tombstone) is skipped – the call is idempotent. Validation happens
   * before anything is written, so one invalid item rejects the whole batch.
   */
  createMany(items: { data: T; id?: string }[]): Promise<Stored<T>[]>;
  update(id: string, patch: Partial<T>): Promise<Stored<T>>;
  /** Create with a fixed id, or replace all data fields of the existing record. */
  upsert(id: string, data: T): Promise<Stored<T>>;
  /** Soft delete (tombstone). */
  remove(id: string): Promise<void>;
  removeMany(ids: string[]): Promise<void>;
  restore(id: string): Promise<void>;
}

export const notDeleted = (r: { deletedAt: number | null }): boolean => r.deletedAt === null;

const envelope = new Set<string>(ENVELOPE_KEYS);

function dataOf(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => !envelope.has(k)));
}

export function createRepo<T extends Record<string, unknown>>(
  name: string,
  schema: z.ZodType<T>,
  database: TaschenmesserDB = defaultDb,
): Repo<T> {
  type Row = Stored<T>;
  const table = () => database.table<Row, string>(name);
  const outbox = () => database.table('_outbox');

  function parse(data: unknown): Record<string, unknown> {
    const parsed = schema.parse(data) as Record<string, unknown>;
    // Optional fields set to undefined are treated as absent.
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined));
  }

  /** Pure row builders: no I/O, so they can never break a Dexie transaction. */
  function buildCreated(ctx: DeviceContext, data: T, id: string): Row {
    const values = parse(data);
    const ts = now();
    const stamp = ctx.clock.tick();
    const _f: Record<string, string> = { deletedAt: stamp };
    for (const k of Object.keys(values)) _f[k] = stamp;
    return {
      ...values,
      id,
      createdAt: ts,
      updatedAt: ts,
      deviceId: ctx.deviceId,
      deletedAt: null,
      _f,
    } as unknown as Row;
  }

  /** Observe every stamp already on the record so the new stamp sorts after them. */
  function observe(ctx: DeviceContext, existing: Row): void {
    const newest = maxHlc(Object.values(existing._f));
    if (newest) ctx.clock.receive(newest);
  }

  /** Returns the updated row, or undefined when nothing changed. */
  function buildUpdated(
    ctx: DeviceContext,
    existing: Row,
    next: Record<string, unknown>,
  ): Row | undefined {
    const current = dataOf(existing as unknown as Record<string, unknown>);
    const keys = new Set([...Object.keys(current), ...Object.keys(next)]);
    const changed = [...keys].filter((k) => !deepEqual(current[k], next[k]));
    if (changed.length === 0) return undefined;
    observe(ctx, existing);
    const stamp = ctx.clock.tick();
    const _f = { ...existing._f };
    for (const k of changed) _f[k] = stamp;
    return {
      ...next,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now(),
      deviceId: ctx.deviceId,
      deletedAt: existing.deletedAt,
      _f,
    } as unknown as Row;
  }

  function buildTombstoned(
    ctx: DeviceContext,
    existing: Row | undefined,
    deleted: boolean,
  ): Row | undefined {
    if (!existing || (existing.deletedAt !== null) === deleted) return undefined;
    observe(ctx, existing);
    const ts = now();
    return {
      ...existing,
      deletedAt: deleted ? ts : null,
      updatedAt: ts,
      deviceId: ctx.deviceId,
      _f: { ...existing._f, deletedAt: ctx.clock.tick() },
    };
  }

  async function saveAll(rows: Row[]): Promise<void> {
    if (rows.length === 0) return;
    await table().bulkPut(rows);
    // `rev` counts writes per record, so the sync engine can tell whether a record changed
    // again while it was being pushed (it only clears entries whose rev it has seen).
    const previous = await outbox().bulkGet(rows.map((r) => [name, r.id]));
    const queuedAt = now();
    await outbox().bulkPut(
      rows.map((r, i) => ({
        collection: name,
        id: r.id,
        queuedAt,
        rev: (previous[i]?.rev ?? 0) + 1,
      })),
    );
  }

  /** Loads the device context first: nothing foreign may be awaited inside a Dexie transaction. */
  async function write<R>(fn: (ctx: DeviceContext) => Promise<R>): Promise<R> {
    const ctx = await getDeviceContext(database);
    // Erased generics: Dexie's transaction() overloads make TS inference explode on a generic R.
    const run = (
      database as unknown as {
        transaction(mode: 'rw', tables: unknown[], scope: () => Promise<R>): Promise<R>;
      }
    ).transaction.bind(database);
    return run('rw', [table(), outbox()], () => fn(ctx));
  }

  const setDeletedMany = (ids: string[], deleted: boolean): Promise<void> =>
    write(async (ctx) => {
      const existing = await table().bulkGet(ids);
      const rows = existing
        .map((e) => buildTombstoned(ctx, e, deleted))
        .filter((r): r is Row => r !== undefined);
      await saveAll(rows);
    });

  return {
    name,
    get table() {
      return table();
    },
    active: () => table().toCollection().filter(notDeleted),
    async get(id) {
      const r = await table().get(id);
      return r && notDeleted(r) ? r : undefined;
    },
    create: (data, opts) =>
      write(async (ctx) => {
        const row = buildCreated(ctx, data, opts?.id ?? randomId());
        await saveAll([row]);
        return row;
      }),
    createMany: (items) =>
      write(async (ctx) => {
        const ids = items.map((item) => item.id ?? randomId());
        const existing = await table().bulkGet(ids);
        const rows: Row[] = [];
        items.forEach((item, i) => {
          if (existing[i]) return;
          rows.push(buildCreated(ctx, item.data, ids[i]!));
        });
        await saveAll(rows);
        return rows;
      }),
    update: (id, patch) =>
      write(async (ctx) => {
        const existing = await table().get(id);
        if (!existing || !notDeleted(existing))
          throw new Error(`${name}: record "${id}" not found`);
        const next = parse({ ...dataOf(existing as unknown as Record<string, unknown>), ...patch });
        const row = buildUpdated(ctx, existing, next);
        if (!row) return existing;
        await saveAll([row]);
        return row;
      }),
    upsert: (id, data) =>
      write(async (ctx) => {
        const existing = await table().get(id);
        const row = existing
          ? buildUpdated(ctx, existing, parse(data))
          : buildCreated(ctx, data, id);
        if (!row) return existing!;
        await saveAll([row]);
        return row;
      }),
    remove: (id) => setDeletedMany([id], true),
    removeMany: (ids) => setDeletedMany(ids, true),
    restore: (id) => setDeletedMany([id], false),
  };
}
