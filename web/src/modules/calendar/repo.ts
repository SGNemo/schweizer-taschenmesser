import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { eventSchema } from './schema';

export const eventRepo = createRepo(tableName('calendar', 'event'), eventSchema);
