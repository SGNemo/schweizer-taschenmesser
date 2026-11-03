import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { calendarSchema, eventSchema, externalEventSchema } from './schema';

export const eventRepo = createRepo(tableName('calendar', 'event'), eventSchema);
export const externalRepo = createRepo(tableName('calendar', 'external'), externalEventSchema);
export const calendarRepo = createRepo(tableName('calendar', 'calendar'), calendarSchema);
