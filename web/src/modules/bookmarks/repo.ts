import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { itemSchema } from './schema';

export const itemRepo = createRepo(tableName('bookmarks', 'item'), itemSchema);
