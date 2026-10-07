import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Stored } from '@/core/db/types';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { whatsappUrl } from '@/core/links';
import { formatMoney } from '@/core/money';
import { getPlatform } from '@/core/platform';
import { formatDay, today } from '@/core/time/dates';
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
  TextField,
} from '@/ui';
import { GiftEditor, type GiftTarget } from '../components/GiftEditor';
import { PersonEditor, type PersonTarget } from '../components/PersonEditor';
import { ageOn, daysUntil, nextBirthday, sortByNext, sortGifts, totals, whenLabel } from '../logic';
import { giftRepo, personRepo } from '../repo';
import type { Gift, Person } from '../schema';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function congratulate(name: string) {
  void getPlatform().app.openUrl(whatsappUrl(t.people.wish(name)));
}

export default function PeoplePage() {
  const people = useLiveQuery(() => personRepo.active().toArray(), []);
  const gifts = useLiveQuery(() => giftRepo.active().toArray(), []);
  const [params, setParams] = useSearchParams();
  const selected = params.get('person');
  const person = people?.find((p) => p.id === selected);
  if (selected && people && !person) {
    // The person is gone (deleted on another device): back to the list.
    setParams({}, { replace: true });
  }
  return person ? (
    <PersonDetail
      person={person}
      gifts={(gifts ?? []).filter((g) => g.personId === person.id)}
      onBack={() => setParams({})}
    />
  ) : (
    <PeopleList people={people} gifts={gifts} onOpen={(id) => setParams({ person: id })} />
  );
}

function PeopleList({
  people,
  gifts,
  onOpen,
}: {
  people: Stored<Person>[] | undefined;
  gifts: Stored<Gift>[] | undefined;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<PersonTarget>(null);
  const [params, setParams] = useSearchParams();
  const day = today();

  const openTarget = target ?? (params.get('new') ? { draft: true as const } : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const open = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of gifts ?? [])
      if (g.status !== 'given') map.set(g.personId, (map.get(g.personId) ?? 0) + 1);
    return map;
  }, [gifts]);
  const q = fold(query.trim());
  const shown = useMemo(
    () =>
      sortByNext(people ?? [], day).filter(
        (p) => !q || fold(`${p.name} ${p.note ?? ''} ${p.tags.join(' ')}`).includes(q),
      ),
    [people, q, day],
  );

  return (
    <>
      <PageHeader title={t.people.title}>
        <Button variant="primary" onClick={() => setTarget({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.people.add}
        </Button>
      </PageHeader>
      {people && people.length === 0 ? (
        <EmptyState title={t.people.empty}>
          <StartDataButton moduleId="people" />
        </EmptyState>
      ) : null}
      {people && people.length > 0 ? (
        <TextField
          label={t.people.search}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      ) : null}
      {people && people.length > 0 && shown.length === 0 ? <p>{t.people.emptyFiltered}</p> : null}
      <ItemList layout="grid" label={t.people.title}>
        {shown.map((p) => {
          const b = p.birthday;
          const next = b ? nextBirthday(b, day) : undefined;
          const age = b && next ? ageOn(b, next) : undefined;
          const gifting = open.get(p.id) ?? 0;
          return (
            <ItemRow
              key={p.id}
              title={p.name}
              meta={[
                next ? formatDay(next, 'EEE, d. MMMM') : undefined,
                age !== undefined ? t.people.turns(age) : undefined,
                b ? whenLabel(daysUntil(b, day)) : undefined,
                gifting ? t.people.giftsOpen(gifting) : undefined,
              ]
                .filter(Boolean)
                .join(' · ')}
              onOpen={() => onOpen(p.id)}
              end={
                b ? (
                  <IconButton
                    label={t.people.congratulate(p.name)}
                    onClick={() => congratulate(p.name)}
                  >
                    <Icon name="external" size={18} />
                  </IconButton>
                ) : undefined
              }
            />
          );
        })}
      </ItemList>
      <PersonEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}

function PersonDetail({
  person,
  gifts,
  onBack,
}: {
  person: Stored<Person>;
  gifts: Stored<Gift>[];
  onBack: () => void;
}) {
  const [editing, setEditing] = useState<PersonTarget>(null);
  const [gift, setGift] = useState<GiftTarget>(null);
  const day = today();
  const b = person.birthday;
  const next = b ? nextBirthday(b, day) : undefined;
  const age = b && next ? ageOn(b, next) : undefined;
  const sum = totals(gifts);
  return (
    <>
      <PageHeader title={person.name}>
        <Button onClick={onBack}>{t.people.back}</Button>
        <Button onClick={() => setEditing(person)}>
          <Icon name="edit" size={18} />
          {t.people.edit}
        </Button>
      </PageHeader>
      <p>
        {[
          next ? formatDay(next, 'EEE, d. MMMM') : t.people.noBirthday,
          age !== undefined ? t.people.turns(age) : undefined,
          b ? whenLabel(daysUntil(b, day)) : undefined,
        ]
          .filter(Boolean)
          .join(' · ')}{' '}
        {b ? (
          <IconButton
            label={t.people.congratulate(person.name)}
            onClick={() => congratulate(person.name)}
          >
            <Icon name="external" size={18} />
          </IconButton>
        ) : null}
      </p>
      {person.tags.length > 0 ? (
        <p className={patternStyles.hstackTight}>
          {person.tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </p>
      ) : null}
      {person.note ? <p>{person.note}</p> : null}
      <h2>{t.people.giftsHeading}</h2>
      <Button variant="primary" onClick={() => setGift({ draft: true })}>
        <Icon name="plus" size={18} />
        {t.people.addGift}
      </Button>
      {gifts.length === 0 ? <p>{t.people.giftsEmpty}</p> : null}
      {sum.bought + sum.given > 0 ? (
        <p data-testid="gifts-total">
          {t.people.gift.total(sum.bought + sum.given, formatMoney(sum.spentCents))}
        </p>
      ) : null}
      <ItemList label={t.people.giftsHeading}>
        {sortGifts(gifts).map((g) => (
          <ItemRow
            key={g.id}
            title={g.title}
            meta={[
              g.occasion,
              g.date ? formatDay(g.date, 'dd.MM.yyyy') : undefined,
              g.priceCents !== undefined ? formatMoney(g.priceCents) : undefined,
            ]
              .filter(Boolean)
              .join(' · ')}
            onOpen={() => setGift(g)}
            end={
              <span className={patternStyles.hstackTight}>
                <Badge tone={g.status === 'idea' ? 'accent' : 'neutral'}>
                  {t.people.gift.statuses[g.status]}
                </Badge>
                {g.url ? (
                  <IconButton
                    label={`${t.people.gift.openLink}: ${g.title}`}
                    onClick={() => void getPlatform().app.openUrl(g.url!)}
                  >
                    <Icon name="external" size={16} />
                  </IconButton>
                ) : null}
              </span>
            }
          />
        ))}
      </ItemList>
      <PersonEditor target={editing} onClose={() => setEditing(null)} onDeleted={onBack} />
      <GiftEditor target={gift} personId={person.id} onClose={() => setGift(null)} />
    </>
  );
}
