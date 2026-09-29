import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { noteSchema } from './schema';

export const noteRepo = createRepo(tableName('notes', 'note'), noteSchema);
