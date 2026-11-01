import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { placeSchema, regionSchema, routeSchema, tileSchema } from './schema';

export const placeRepo = createRepo(tableName('maps', 'place'), placeSchema);
export const routeRepo = createRepo(tableName('maps', 'route'), routeSchema);
/** The own map: device-local caches (nothing queued for sync, `purge` allowed). */
export const regionRepo = createRepo(tableName('maps', 'region'), regionSchema, undefined, {
  local: true,
});
export const tileRepo = createRepo(tableName('maps', 'tile'), tileSchema, undefined, {
  local: true,
});
