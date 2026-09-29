import type { TaschenmesserDB } from './db';

/**
 * Runs `fn` in a read-write transaction over `tables`. Dexie's `transaction()` overloads make
 * TypeScript inference explode when the result type is generic, so the signature is erased here.
 * Inside `fn` only Dexie operations may be awaited.
 */
export function rwTransaction<R>(
  database: TaschenmesserDB,
  tables: unknown[],
  fn: () => Promise<R>,
): Promise<R> {
  const run = (
    database as unknown as {
      transaction(mode: 'rw', tables: unknown[], scope: () => Promise<R>): Promise<R>;
    }
  ).transaction.bind(database);
  return run('rw', tables, fn);
}
