import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { eventSchema, externalEventSchema } from './schema';

export const eventRepo = createRepo(tableName('calendar', 'event'), eventSchema);
export const externalRepo = createRepo(tableName('calendar', 'external'), externalEventSchema);
