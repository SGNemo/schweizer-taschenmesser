import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { birthdaySchema } from './schema';

export const birthdayRepo = createRepo(tableName('birthdays', 'birthday'), birthdaySchema);
