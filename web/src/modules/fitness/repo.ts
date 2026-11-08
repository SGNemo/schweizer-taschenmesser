import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { mealSchema, sessionSchema } from './schema';

export const sessionRepo = createRepo(tableName('fitness', 'session'), sessionSchema);
export const mealRepo = createRepo(tableName('fitness', 'meal'), mealSchema);
