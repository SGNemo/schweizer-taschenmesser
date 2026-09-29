import { primaryAccountId } from './repo';

/** Bookings created by the assistant go to the primary account. */
export default async function defaults(collection: string): Promise<Record<string, unknown>> {
  return collection === 'transaction' ? { accountId: await primaryAccountId() } : {};
}
