import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { itemSchema } from './schema';

/** Device-local: nothing is queued for sync, and the sweep can really delete (`purge`). */
export const itemRepo = createRepo(tableName('exchange', 'item'), itemSchema, undefined, {
  local: true,
});
