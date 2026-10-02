import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { itemSchema, listSchema } from './schema';

export const listRepo = createRepo(tableName('packing', 'list'), listSchema);
export const itemRepo = createRepo(tableName('packing', 'item'), itemSchema);
