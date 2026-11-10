import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { mealSchema, sessionSchema, templateSchema } from './schema';

export const sessionRepo = createRepo(tableName('fitness', 'session'), sessionSchema);
export const mealRepo = createRepo(tableName('fitness', 'meal'), mealSchema);
export const templateRepo = createRepo(tableName('fitness', 'template'), templateSchema);
