import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getPlatform } from '@/core/platform';
import { formatMoney } from '@/core/money';
import { formatDay } from '@/core/time/dates';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { t } from '@/strings';
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  IconButton,
  ItemList,
  ItemRow,
  PageHeader,
  patternStyles,
  Segmented,
} from '@/ui';
import { IdeaEditor, type IdeaTarget } from '../components/IdeaEditor';
import { applyFilter, groupByPerson, totals, type StatusFilter } from '../logic';
import { ideaRepo } from '../repo';
import { STATUSES } from '../schema';
import styles from '@/pages/Page.module.css';

export default function GiftsPage() {
  const ideas = useLiveQuery(() => ideaRepo.active().toArray(), []);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [target, setTarget] = useState<IdeaTarget>(null);
  const [params, setParams] = useSearchParams();

  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const close = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const people = useMemo(
    () =>
      [...new Set((ideas ?? []).map((i) => i.forWhom.trim()))].sort((a, b) =>
        a.localeCompare(b, 'de'),
      ),
    [ideas],
  );
  const groups = useMemo(() => groupByPerson(applyFilter(ideas ?? [], filter)), [ideas, filter]);
  const sum = totals(ideas ?? []);

  return (
    <>
      <PageHeader title={t.gifts.title}>
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.gifts.add}
        </Button>
      </PageHeader>
      {ideas && ideas.length === 0 ? (
        <EmptyState title={t.gifts.empty}>
          <StartDataButton moduleId="gifts" />
        </EmptyState>
      ) : null}
      {ideas && ideas.length > 0 ? (
        <>
          <Segmented
            label={t.gifts.filter}
            value={filter}
            options={[
              { value: 'all' as const, label: t.gifts.all },
              ...STATUSES.map((s) => ({ value: s, label: t.gifts.statuses[s] })),
            ]}
            onChange={setFilter}
          />
          <p className={styles.lead} data-testid="gifts-total">
            {t.gifts.total(sum.bought + sum.given, formatMoney(sum.spentCents))}
          </p>
          {groups.length === 0 ? <p className={styles.lead}>{t.gifts.noMatch}</p> : null}
        </>
      ) : null}
      {groups.map((g) => (
        <section key={g.person} aria-label={g.person} className={styles.section}>
          <h2>{g.person}</h2>
          <ItemList label={g.person}>
            {g.ideas.map((i) => (
              <ItemRow
                key={i.id}
                title={i.title}
                meta={[
                  i.occasion,
                  i.date ? formatDay(i.date, 'dd.MM.yyyy') : undefined,
                  i.priceCents !== undefined ? formatMoney(i.priceCents) : undefined,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onOpen={() => setTarget(i)}
                end={
                  <span className={patternStyles.hstackTight}>
                    <Badge tone={i.status === 'idea' ? 'accent' : 'neutral'}>
                      {t.gifts.statuses[i.status]}
                    </Badge>
                    {i.url ? (
                      <IconButton
                        label={`${t.gifts.openLink}: ${i.title}`}
                        onClick={() => void getPlatform().app.openUrl(i.url!)}
                      >
                        <Icon name="external" size={16} />
                      </IconButton>
                    ) : null}
                  </span>
                }
              />
            ))}
          </ItemList>
        </section>
      ))}
      <IdeaEditor target={openTarget} people={people} onClose={close} />
    </>
  );
}
