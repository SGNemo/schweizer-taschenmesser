import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { contractSchema } from './schema';

export const contractRepo = createRepo(tableName('contracts', 'contract'), contractSchema);
