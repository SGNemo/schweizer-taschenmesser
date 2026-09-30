import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { linkSchema } from './schema';

export const linkRepo = createRepo(tableName('launcher', 'link'), linkSchema);
