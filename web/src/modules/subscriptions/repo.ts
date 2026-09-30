import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { subscriptionSchema } from './schema';

export const subscriptionRepo = createRepo(
  tableName('subscriptions', 'subscription'),
  subscriptionSchema,
);
