import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { daysUntil, sortByNext, whenLabel } from '../logic';
import { birthdayRepo } from '../repo';

export default function NextBirthdaysWidget() {
  const list = useLiveQuery(() => birthdayRepo.active().toArray(), []);
  const day = today();
  return (
    <WidgetList
      loading={!list}
      empty={t.birthdays.widgetEmpty}
      entries={sortByNext(list ?? [], day)
        .slice(0, 4)
        .map((b) => ({ key: b.id, title: b.name, meta: whenLabel(daysUntil(b, day)) }))}
      to="/birthdays"
      linkLabel={t.birthdays.title}
    />
  );
}
