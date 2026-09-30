import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { entrySchema, vaultSchema } from './schema';

export const vaultRepo = createRepo(tableName('accounts', 'vault'), vaultSchema);
export const entryRepo = createRepo(tableName('accounts', 'entry'), entrySchema);
