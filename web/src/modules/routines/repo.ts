import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { routineSchema } from './schema';

export const routineRepo = createRepo(tableName('routines', 'routine'), routineSchema);
