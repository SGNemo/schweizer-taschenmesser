import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { entrySchema } from './schema';

export const entryRepo = createRepo(tableName('__ID__', 'entry'), entrySchema);
