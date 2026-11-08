import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { daySum, weekOf, weekSummary } from '../logic';
import { mealRepo, sessionRepo } from '../repo';

/** This week's sessions and today's kcal (`undefined` while loading). Reads only own data. */
export function useFitness(weekStart: 1 | 7) {
  const day = today();
  return useLiveQuery(async () => {
    const range = weekOf(day, weekStart);
    const sessions = (await sessionRepo.active().toArray()).filter(
      (s) => s.date >= range.from && s.date <= range.to,
    );
    const meals = (await mealRepo.active().toArray()).filter((m) => m.date === day);
    return { week: weekSummary(sessions, range), kcal: daySum(meals, day), meals: meals.length };
  }, [day, weekStart]);
}
