import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { reminderSchema } from './schema';

export const reminderRepo = createRepo(tableName('reminders', 'reminder'), reminderSchema);
