import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { entrySchema, projectSchema } from './schema';

export const projectRepo = createRepo(tableName('timetrack', 'project'), projectSchema);
export const entryRepo = createRepo(tableName('timetrack', 'entry'), entrySchema);
