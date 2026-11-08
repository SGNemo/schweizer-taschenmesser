import { today } from '@/core/time/dates';

/**
 * The assistant (and quick capture) never has to name a day: a new meal or session is for today. A session
 * for a later day is a plan, as in the form.
 */
export default async function defaults(
  collection: string,
  data?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (collection !== 'meal' && collection !== 'session') return {};
  if (!data?.date) return { date: today() };
  if (collection === 'session' && typeof data.date === 'string' && data.date > today())
    return { planned: true };
  return {};
}
