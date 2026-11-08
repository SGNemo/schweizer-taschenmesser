import { formatMinutes } from '@/core/i18n/format';
import { useWeekStart } from '@/core/settings/core';
import { t } from '@/strings';
import { FortschrittBody, WidgetBody, type FortschrittEntry } from '@/ui';
import { kcalText, useFitnessSettings } from '../data';
import { useFitness } from './useFitness';

/**
 * This week's training and today's kcal as two bars (`fortschritt`). Calm by design: a bar fills only
 * against a goal the user set; past the kcal goal the row says it in plain words, never in red
 * (no `overText`, docs/features/fitness.md §6).
 */
export default function FitnessWidget() {
  const weekStart = useWeekStart();
  const data = useFitness(weekStart);
  const prefs = useFitnessSettings();
  const w = t.fitness.widget;
  const entries: FortschrittEntry[] = [];
  if (data) {
    const sessions = prefs.weekSessions
      ? w.sessionsOf(data.week.count, prefs.weekSessions)
      : w.sessions(data.week.count);
    entries.push({
      key: 'week',
      title: w.week,
      value: Math.min(data.week.count, prefs.weekSessions),
      max: prefs.weekSessions,
      detail: w.weekDetail(
        sessions,
        data.week.minutes ? formatMinutes(data.week.minutes, { compact: true }) : '',
      ),
    });
    if (prefs.nutrition) {
      const goal = prefs.kcalGoal;
      const kcal = kcalText(data.kcal);
      entries.push({
        key: 'today',
        title: w.today,
        value: Math.min(data.kcal, goal),
        max: goal,
        detail: !goal
          ? w.kcal(kcal)
          : data.kcal > goal
            ? w.kcalPastGoal(kcal, kcalText(goal))
            : w.kcalOf(kcal, kcalText(goal)),
      });
    }
  }
  const isEmpty = !!data && data.week.count === 0 && (!prefs.nutrition || data.meals === 0);
  return (
    <WidgetBody
      loading={!data}
      isEmpty={isEmpty}
      empty={w.empty}
      emptyAction={{ label: t.fitness.addSession, to: '/fitness?new=session' }}
    >
      <FortschrittBody kind="bars" entries={entries} />
    </WidgetBody>
  );
}
