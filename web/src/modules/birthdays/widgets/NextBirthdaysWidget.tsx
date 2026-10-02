import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { t } from '@/strings';
import { DueList } from '@/ui';
import { nextBirthday, sortByNext } from '../logic';
import { birthdayRepo } from '../repo';

/** Birthdays count as "soon" two weeks ahead, longer than a due date. */
const SOON_DAYS = 14;

export default function NextBirthdaysWidget() {
  const list = useLiveQuery(() => birthdayRepo.active().toArray(), []);
  const day = today();
  return (
    <DueList
      loading={!list}
      empty={t.birthdays.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.birthdays, to: '/birthdays?new=1' }}
      entries={sortByNext(list ?? [], day).map((b) => {
        const s = dueState(nextBirthday(b, day), day, { soonDays: SOON_DAYS });
        return { key: b.id, title: b.name, tone: s.tone, label: s.label };
      })}
      moreLabel={t.widgets.more}
    />
  );
}
