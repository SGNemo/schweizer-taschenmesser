import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatDay, relativeDayLabel, today } from '@/core/time/dates';
import { t } from '@/strings';
import { Badge, Button, EmptyState, Icon, ItemList, ItemRow, PageHeader } from '@/ui';
import { ContractEditor, type ContractTarget } from '../components/ContractEditor';
import { cancelDeadline, sortContracts, statusOf } from '../logic';
import { contractRepo } from '../repo';

export default function ContractsPage() {
  const list = useLiveQuery(() => contractRepo.active().toArray(), []);
  const [target, setTarget] = useState<ContractTarget>(null);
  const [params, setParams] = useSearchParams();
  const day = today();

  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  return (
    <>
      <PageHeader title={t.contracts.title}>
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.contracts.add}
        </Button>
      </PageHeader>
      {list && list.length === 0 ? <EmptyState icon="file" title={t.contracts.empty} /> : null}
      <ItemList label={t.contracts.title}>
        {sortContracts(list ?? [], day).map((c) => {
          const status = statusOf(c, day);
          const deadline = cancelDeadline(c);
          return (
            <ItemRow
              key={c.id}
              title={c.name}
              onOpen={() => setTarget(c)}
              meta={[
                t.contracts.kinds[c.kind],
                c.provider,
                c.endDate
                  ? `${t.contracts.endLabel}: ${formatDay(c.endDate, 'd. MMM yyyy')}`
                  : undefined,
                deadline && status !== 'expired'
                  ? `${t.contracts.deadlineLabel}: ${relativeDayLabel(deadline, day)}`
                  : undefined,
              ]
                .filter(Boolean)
                .join(' · ')}
              end={
                status === 'ok' || status === 'open-ended' ? undefined : (
                  <Badge tone={status === 'act-now' ? 'accent' : 'neutral'}>
                    {t.contracts.status[status]}
                  </Badge>
                )
              }
            />
          );
        })}
      </ItemList>
      <ContractEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}
