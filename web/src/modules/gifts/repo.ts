import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { ideaSchema } from './schema';

export const ideaRepo = createRepo(tableName('gifts', 'idea'), ideaSchema);
