import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { blockruleSchema, bookmarkSchema, historySchema } from './schema';

// Everything the browser stores stays on this device: nothing is queued for sync.
export const bookmarkRepo = createRepo(
  tableName('browser', 'bookmark'),
  bookmarkSchema,
  undefined,
  {
    local: true,
  },
);
export const historyRepo = createRepo(tableName('browser', 'history'), historySchema, undefined, {
  local: true,
});
export const blockruleRepo = createRepo(
  tableName('browser', 'blockrule'),
  blockruleSchema,
  undefined,
  {
    local: true,
  },
);
