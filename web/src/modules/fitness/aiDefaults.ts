import { today } from '@/core/time/dates';

/** The assistant (and quick capture) never has to name a day: a new meal or session is for today. */
export default async function defaults(
  collection: string,
  data?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if ((collection === 'meal' || collection === 'session') && !data?.date) return { date: today() };
  return {};
}
