import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { placeSchema, routeSchema } from './schema';

export const placeRepo = createRepo(tableName('maps', 'place'), placeSchema);
export const routeRepo = createRepo(tableName('maps', 'route'), routeSchema);
