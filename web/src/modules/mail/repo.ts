import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { bodySchema, linkSchema, threadSchema } from './schema';

/** Device-local caches (nothing queued for sync, `purge` allowed). */
export const threadRepo = createRepo(tableName('mail', 'thread'), threadSchema, undefined, {
  local: true,
});
export const bodyRepo = createRepo(tableName('mail', 'body'), bodySchema, undefined, {
  local: true,
});
export const linkRepo = createRepo(tableName('mail', 'link'), linkSchema, undefined, {
  local: true,
});
