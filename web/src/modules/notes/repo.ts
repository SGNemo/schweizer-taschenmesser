import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { noteSchema, notebookSchema } from './schema';

export const noteRepo = createRepo(tableName('notes', 'note'), noteSchema);
export const notebookRepo = createRepo(tableName('notes', 'notebook'), notebookSchema);
