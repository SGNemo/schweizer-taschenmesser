import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { messageSchema, threadSchema } from './schema';

export const threadRepo = createRepo(tableName('chat', 'thread'), threadSchema);
export const messageRepo = createRepo(tableName('chat', 'message'), messageSchema);
