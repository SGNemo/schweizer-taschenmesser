import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { t } from '@/strings';
import { DueList } from '@/ui';
import { nextBirthday, sortByNext } from '../logic';
import { giftRepo, personRepo } from '../repo';

/** Birthdays count as "soon" two weeks ahead, longer than a due date. */
const SOON_DAYS = 14;

/** The next birthdays; the context line says how many gifts are still open. */
export default function NextBirthdaysWidget() {
  const data = useLiveQuery(async () => {
    const [people, gifts] = await Promise.all([
      personRepo.active().toArray(),
      giftRepo.active().toArray(),
    ]);
    return { people, open: gifts.filter((g) => g.status !== 'given').length };
  }, []);
  const day = today();
  return (
    <DueList
      loading={!data}
      empty={t.people.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.people, to: '/people?new=1' }}
      summary={data && data.open > 0 ? t.people.widgetSummary(data.open) : undefined}
      entries={sortByNext(
        (data?.people ?? []).filter((p) => p.birthday),
        day,
      ).map((p) => {
        const s = dueState(nextBirthday(p.birthday!, day), day, { soonDays: SOON_DAYS });
        return { key: p.id, title: p.name, tone: s.tone, label: s.label };
      })}
      moreLabel={t.widgets.more}
    />
  );
}
