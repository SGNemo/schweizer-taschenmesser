import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import { Button, EmptyState, Icon, ItemList, ItemRow, PageHeader } from '@/ui';
import { BirthdayEditor, type BirthdayTarget } from '../components/BirthdayEditor';
import { ageOn, daysUntil, nextBirthday, sortByNext, whenLabel } from '../logic';
import { birthdayRepo } from '../repo';

export default function BirthdaysPage() {
  const list = useLiveQuery(() => birthdayRepo.active().toArray(), []);
  const [target, setTarget] = useState<BirthdayTarget>(null);
  const [params, setParams] = useSearchParams();
  const day = today();

  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  return (
    <>
      <PageHeader title={t.birthdays.title}>
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.birthdays.add}
        </Button>
      </PageHeader>
      {list && list.length === 0 ? <EmptyState icon="cake" title={t.birthdays.empty} /> : null}
      <ItemList label={t.birthdays.title}>
        {sortByNext(list ?? [], day).map((b) => {
          const next = nextBirthday(b, day);
          const age = ageOn(b, next);
          return (
            <ItemRow
              key={b.id}
              title={b.name}
              meta={[
                formatDay(next, 'EEE, d. MMMM'),
                age !== undefined ? t.birthdays.turns(age) : undefined,
                whenLabel(daysUntil(b, day)),
              ]
                .filter(Boolean)
                .join(' · ')}
              onOpen={() => setTarget(b)}
            />
          );
        })}
      </ItemList>
      <BirthdayEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}
