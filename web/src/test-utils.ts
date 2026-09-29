import { TaschenmesserDB } from '@/core/db/db';

let counter = 0;

/** Fresh, isolated database per test (fake-indexeddb). */
export function createTestDb(): TaschenmesserDB {
  return new TaschenmesserDB(`test-${Date.now()}-${counter++}`);
}
