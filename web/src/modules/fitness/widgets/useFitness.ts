import { useLiveQuery } from 'dexie-react-hooks';
import { notDeleted } from '@/core/db/repo';
import { today } from '@/core/time/dates';
import { daySum, weekOf, weekSummary } from '../logic';
import { mealRepo, sessionRepo } from '../repo';

/** This week's sessions and today's kcal (`undefined` while loading). Reads only own data. */
export function useFitness(weekStart: 1 | 7) {
  const day = today();
  return useLiveQuery(async () => {
    const range = weekOf(day, weekStart);
    const sessions = (
      await sessionRepo.table.where('date').between(range.from, range.to, true, true).toArray()
    ).filter(notDeleted);
    const meals = (await mealRepo.table.where('date').equals(day).toArray()).filter(notDeleted);
    return { week: weekSummary(sessions, range), kcal: daySum(meals, day), meals: meals.length };
  }, [day, weekStart]);
}
