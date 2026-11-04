import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { feedSchema } from './schema';

export const feedRepo = createRepo(tableName('feeds', 'feed'), feedSchema);
