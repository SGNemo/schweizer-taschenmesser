import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { articleSchema, feedSchema, feedStateSchema } from './schema';

export const feedRepo = createRepo(tableName('news', 'feed'), feedSchema);
export const articleRepo = createRepo(tableName('news', 'article'), articleSchema, undefined, {
  local: true,
});
export const feedStateRepo = createRepo(
  tableName('news', 'feedstate'),
  feedStateSchema,
  undefined,
  {
    local: true,
  },
);
