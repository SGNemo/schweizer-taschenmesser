import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Stored } from '@/core/db/types';
import { StartDataMenu } from '@/core/importer/StartDataMenu';
import { SignatureMark } from '@/ui/identity';
import { formatMoney } from '@/core/money';
import { getPlatform } from '@/core/platform';
import { formatDay, today } from '@/core/time/dates';
import { changeWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  Badge,
  Button,
  DetailPanel,
  EmptyState,
  Icon,
  IconButton,
  ItemList,
  ItemRow,
  PageAction,
  PageHeader,
  patternStyles,
  SplitView,
  Tabs,
  TextField,
  useAdvancedMenuItem,
  useOpenParam,
  useSplitView,
} from '@/ui';
import { NextBirthdayHead, PersonRing } from '../components/PersonRing';
import { GiftEditor, type GiftTarget } from '../components/GiftEditor';
import { PersonEditor, type PersonTarget } from '../components/PersonEditor';
import {
  ageOn,
  budgetLeft,
  congratsLinks,
  daysUntil,
  nextBirthday,
  openGiftsWithPerson,
  sortByNext,
  sortGifts,
  totals,
  metaLine,
  whenLabel,
} from '../logic';
import { inboxSchema, removeIdea, SCOPE as INBOX_SCOPE } from '../inbox';
import { giftRepo, personRepo } from '../repo';
import { useSettings } from '@/core/settings/settings';
import type { Gift, Person } from '../schema';
import styles from './people.module.css';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Opens the first way to congratulate (WhatsApp, with the number when it is known). */
function congratulate(person: Person) {
  const [first] = congratsLinks(person, t.people.wish(person.name), t.people.wishSubject);
  if (first) void getPlatform().app.openUrl(first.url);
}

export default function PeoplePage() {
  const people = useLiveQuery(() => personRepo.active().toArray(), []);
  const gifts = useLiveQuery(() => giftRepo.active().toArray(), []);
  const [params, setParams] = useSearchParams();
  // A search hit links here with ?open=<id>: show that person (or the person a gift belongs to).
  useOpenParam(
    async (id) => (await personRepo.get(id)) ?? (await giftRepo.get(id)),
    (r) => ({ person: 'personId' in r ? r.personId : r.id }),
  );
  const selected = params.get('person');
  const person = people?.find((p) => p.id === selected);
  if (selected && people && !person) {
    // The person is gone (deleted on another device): back to the list.
    setParams({}, { replace: true });
  }
  // Master–detail (layout `split`): on a wide page the person lies in the panel beside the list; below that width
  // the person is a page of its own, as before.
  const wide = useSplitView();
  return person && !wide ? (
    <PersonDetail
      person={person}
      gifts={(gifts ?? []).filter((g) => g.personId === person.id)}
      onBack={() => setParams({})}
    />
  ) : (
    <PeopleList
      people={people}
      gifts={gifts}
      wide={wide}
      selectedId={wide ? (person?.id ?? null) : null}
      onOpen={(id) => setParams({ person: id }, { replace: wide })}
    />
  );
}

/** One tap: "Verschenkt", undoable. */
function markGiven(id: string) {
  void changeWithUndo(() => giftRepo.update(id, { status: 'given' }), t.people.giftGiven);
}

/** Right side of a gift row: status badge, the one-tap "Verschenkt" and the link. */
function GiftBadge({ gift: g }: { gift: Stored<Gift> }) {
  return (
    <Badge tone={g.status === 'idea' ? 'accent' : 'neutral'}>
      {t.people.gift.statuses[g.status]}
    </Badge>
  );
}

function GiftEnd({ gift }: { gift: Stored<Gift> }) {
  return (
    <span className={patternStyles.hstackTight}>
      <GiftBadge gift={gift} />
      <GiftActions gift={gift} />
    </span>
  );
}

/** What can be done with a gift from its row. In the narrow panel these lie under the row's text, not beside it. */
function GiftActions({ gift: g }: { gift: Stored<Gift> }) {
  if (g.status === 'given' && !g.url) return null;
  return (
    <span className={patternStyles.hstackTight}>
      {g.status !== 'given' ? (
        <Button
          size="sm"
          aria-label={t.people.giftGivenAria(g.title)}
          onClick={() => markGiven(g.id)}
        >
          {t.people.giftGivenAction}
        </Button>
      ) : null}
      {g.url ? (
        <IconButton
          label={`${t.people.gift.openLink}: ${g.title}`}
          onClick={() => void getPlatform().app.openUrl(g.url!)}
        >
          <Icon name="external" size={16} />
        </IconButton>
      ) : null}
    </span>
  );
}

function PeopleList({
  people,
  gifts,
  wide,
  selectedId,
  onOpen,
}: {
  people: Stored<Person>[] | undefined;
  gifts: Stored<Gift>[] | undefined;
  /** The page is wide enough for the detail panel. */
  wide: boolean;
  /** The person picked on a wide page (from the URL). */
  selectedId: string | null;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'people' | 'gifts'>('people');
  const [target, setTarget] = useState<PersonTarget>(null);
  const [params, setParams] = useSearchParams();
  const [closed, setClosed] = useState(false);
  const advancedItem = useAdvancedMenuItem('people');
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
  const pending = useMemo(() => openGiftsWithPerson(gifts ?? [], people ?? []), [gifts, people]);
  const soonest = useMemo(
    () => sortByNext(people ?? [], day).find((p) => p.birthday),
    [people, day],
  );
  const soonestDays = soonest?.birthday ? daysUntil(soonest.birthday, day) : 0;
  const q = fold(query.trim());
  const shown = useMemo(
    () =>
      sortByNext(people ?? [], day).filter(
        (p) => !q || fold(`${p.name} ${p.note ?? ''} ${p.tags.join(' ')}`).includes(q),
      ),
    [people, q, day],
  );

  const isEmpty = !!people && people.length === 0;
  // The panel shows the picked person, else the first of the list (the next birthday).
  const detail =
    !wide || closed || view !== 'people'
      ? undefined
      : ((selectedId ? shown.find((p) => p.id === selectedId) : undefined) ?? shown[0]);
  const pick = (id: string) => {
    // From "Offene Geschenke" too: the person's panel belongs to the list of people.
    setView('people');
    setClosed(false);
    onOpen(id);
  };

  return (
    <>
      <PageHeader
        title={t.people.title}
        views={
          <Tabs
            label={t.people.viewLabel}
            value={view}
            options={[
              { value: 'people' as const, label: t.people.viewPeople },
              { value: 'gifts' as const, label: t.people.viewGifts },
            ]}
            onChange={setView}
          />
        }
        besideContent={!isEmpty}
      >
        {/* While nobody is there the empty state owns the filled button of the view. */}
        <PageAction
          short={t.people.meta.quickAdd}
          variant={isEmpty ? 'secondary' : 'primary'}
          onClick={() => setTarget({ draft: true })}
        >
          <Icon name="plus" size={18} />
          {t.people.add}
        </PageAction>
        <StartDataMenu moduleId="people" items={[advancedItem]} />
      </PageHeader>
      {soonest ? (
        <NextBirthdayHead
          name={soonest.name}
          label={[
            whenLabel(soonestDays),
            ageOn(soonest.birthday!, nextBirthday(soonest.birthday!, day)) !== undefined
              ? t.people.turns(ageOn(soonest.birthday!, nextBirthday(soonest.birthday!, day))!)
              : undefined,
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      ) : null}
      {view === 'gifts' ? (
        <>
          {pending.length === 0 ? (
            <p className={styles.firstRow}>{t.people.giftsNoneOpen}</p>
          ) : null}
          <ItemList label={t.people.viewGifts}>
            {pending.map(({ gift: g, person: p }) => (
              <ItemRow
                key={g.id}
                title={g.title}
                meta={[
                  p.name,
                  g.occasion,
                  g.date ? formatDay(g.date, 'dd.MM.yyyy') : undefined,
                  g.priceCents !== undefined ? formatMoney(g.priceCents) : undefined,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onOpen={() => pick(p.id)}
                onSwipeRight={() => markGiven(g.id)}
                swipeRightLabel={t.people.giftGivenAction}
                end={<GiftEnd gift={g} />}
              />
            ))}
          </ItemList>
        </>
      ) : null}
      {view === 'people' && people && people.length === 0 ? (
        <EmptyState
          title={t.people.empty}
          testId="people-empty"
          motif={<SignatureMark id="avatarRing" size={64} />}
        >
          <Button variant="primary" onClick={() => setTarget({ draft: true })}>
            {t.people.emptyAction}
          </Button>
        </EmptyState>
      ) : null}
      {view === 'people' && people && people.length > 0 ? (
        // The first row of the page: on the phone the page's "⋯" menu lies at its right edge (`besideContent`).
        <div className={styles.firstRow}>
          <TextField
            label={t.people.search}
            labelHidden
            placeholder={t.people.search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-list-search
          />
        </div>
      ) : null}
      {view === 'people' && people && people.length > 0 && shown.length === 0 ? (
        <p>{t.people.emptyFiltered}</p>
      ) : null}
      {view === 'people' ? (
        <SplitView
          enabled={detail !== undefined}
          asideLabel={t.people.detailLabel}
          aside={
            detail ? (
              <PersonPanel
                key={detail.id}
                person={detail}
                gifts={(gifts ?? []).filter((g) => g.personId === detail.id)}
                onClose={() => setClosed(true)}
              />
            ) : null
          }
        >
          <ItemList label={t.people.title}>
            {shown.map((p) => {
              const b = p.birthday;
              const next = b ? nextBirthday(b, day) : undefined;
              const age = b && next ? ageOn(b, next) : undefined;
              const gifting = open.get(p.id) ?? 0;
              return (
                <ItemRow
                  key={p.id}
                  title={p.name}
                  lead={
                    <PersonRing
                      name={p.name}
                      days={b ? daysUntil(b, day) : undefined}
                      size={2.25}
                    />
                  }
                  // U47: the line breaks between phrases only ("in 75 / Tagen" read as two facts).
                  meta={metaLine([
                    next ? formatDay(next, 'EEE, d. MMMM') : undefined,
                    age !== undefined ? t.people.turns(age) : undefined,
                    b ? whenLabel(daysUntil(b, day)) : undefined,
                    gifting ? t.people.giftsOpen(gifting) : undefined,
                  ])}
                  current={detail?.id === p.id}
                  onOpen={() => pick(p.id)}
                  end={
                    b ? (
                      <IconButton
                        label={t.people.congratulate(p.name)}
                        onClick={() => congratulate(p)}
                      >
                        <Icon name="external" size={18} />
                      </IconButton>
                    ) : undefined
                  }
                />
              );
            })}
          </ItemList>
        </SplitView>
      ) : null}
      <PersonEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}

/** The person in the panel of a wide page: the same content as the person's own page, in a `DetailPanel`. */
function PersonPanel({
  person,
  gifts,
  onClose,
}: {
  person: Stored<Person>;
  gifts: Stored<Gift>[];
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<PersonTarget>(null);
  return (
    <>
      <DetailPanel
        testId="person-detail"
        eyebrow={t.people.meta.quickAdd}
        title={person.name}
        onClose={onClose}
        actions={
          <Button onClick={() => setEditing(person)} data-row-edit>
            {t.people.edit}
          </Button>
        }
      >
        <PersonBody person={person} gifts={gifts} inPanel />
      </DetailPanel>
      <PersonEditor target={editing} onClose={() => setEditing(null)} onDeleted={onClose} />
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
  const day = today();
  const b = person.birthday;
  return (
    <>
      {b ? <NextBirthdayHead name={person.name} label={whenLabel(daysUntil(b, day))} /> : null}
      <PageHeader title={person.name}>
        <Button onClick={onBack}>{t.people.back}</Button>
        <Button onClick={() => setEditing(person)}>
          <Icon name="edit" size={18} />
          {t.people.edit}
        </Button>
      </PageHeader>
      <PersonBody person={person} gifts={gifts} />
      <PersonEditor target={editing} onClose={() => setEditing(null)} onDeleted={onBack} />
    </>
  );
}

/** What a person holds: the birthday line, ways to congratulate, tags, note, budget, gift ideas and gifts. */
function PersonBody({
  person,
  gifts,
  inPanel = false,
}: {
  person: Stored<Person>;
  gifts: Stored<Gift>[];
  /** In the panel of the wide page the head owns the one filled button: "Geschenk hinzufügen" is not filled. */
  inPanel?: boolean;
}) {
  const [inbox] = useSettings(INBOX_SCOPE, inboxSchema, { ideas: [] });
  const ideas = inbox?.ideas ?? [];
  // In the panel the person's name is the h2; the sections lie one level below it.
  const Heading = inPanel ? 'h3' : 'h2';
  const [gift, setGift] = useState<GiftTarget>(null);
  const day = today();
  const b = person.birthday;
  const next = b ? nextBirthday(b, day) : undefined;
  const age = b && next ? ageOn(b, next) : undefined;
  const sum = totals(gifts);
  const ideaActions = (idea: (typeof ideas)[number], index: number) => (
    <span className={patternStyles.hstackTight}>
      <Button
        size="sm"
        onClick={() =>
          void giftRepo
            .create({
              personId: person.id,
              title: idea.title,
              status: 'idea',
              ...(idea.url ? { url: idea.url } : {}),
              ...(idea.priceCents !== undefined ? { priceCents: idea.priceCents } : {}),
            })
            .then(() => removeIdea(index))
        }
      >
        {t.people.inbox.take(person.name)}
      </Button>
      <Button size="sm" onClick={() => void removeIdea(index)}>
        {t.people.inbox.dismiss}
      </Button>
    </span>
  );
  return (
    <>
      <p>
        {[
          next ? formatDay(next, 'EEE, d. MMMM') : t.people.noBirthday,
          age !== undefined ? t.people.turns(age) : undefined,
          b ? whenLabel(daysUntil(b, day)) : undefined,
        ]
          .filter(Boolean)
          .join(' · ')}{' '}
      </p>
      {b ? (
        <p className={patternStyles.hstackTight}>
          {congratsLinks(person, t.people.wish(person.name), t.people.wishSubject).map((l) => (
            <Button key={l.id} onClick={() => void getPlatform().app.openUrl(l.url)}>
              {t.people.congratsVia[l.id]}
            </Button>
          ))}
        </p>
      ) : null}
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
      {person.giftBudgetCents !== undefined ? (
        <p data-testid="gift-budget">
          {t.people.budgetLine(
            formatMoney(person.giftBudgetCents),
            formatMoney(Math.abs(budgetLeft(person.giftBudgetCents, gifts))),
            budgetLeft(person.giftBudgetCents, gifts) < 0,
          )}
        </p>
      ) : null}
      {ideas.length > 0 ? (
        <section aria-label={t.people.inbox.title} data-testid="gift-inbox">
          <Heading>{t.people.inbox.title}</Heading>
          <p>{t.people.inbox.hint}</p>
          <ItemList label={t.people.inbox.title}>
            {ideas.map((idea, index) => (
              <ItemRow
                key={`${idea.title}|${idea.url ?? ''}`}
                title={idea.title}
                meta={idea.url}
                {...(inPanel ? {} : { end: ideaActions(idea, index) })}
              >
                {inPanel ? <div className={styles.rowFoot}>{ideaActions(idea, index)}</div> : null}
              </ItemRow>
            ))}
          </ItemList>
        </section>
      ) : null}
      <Heading>{t.people.giftsHeading}</Heading>
      <Button variant={inPanel ? 'secondary' : 'primary'} onClick={() => setGift({ draft: true })}>
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
            end={inPanel ? <GiftBadge gift={g} /> : <GiftEnd gift={g} />}
            onSwipeRight={g.status !== 'given' ? () => markGiven(g.id) : undefined}
            swipeRightLabel={t.people.giftGivenAction}
          >
            {inPanel ? (
              <div className={styles.rowFoot}>
                <GiftActions gift={g} />
              </div>
            ) : null}
          </ItemRow>
        ))}
      </ItemList>
      <GiftEditor target={gift} personId={person.id} onClose={() => setGift(null)} />
    </>
  );
}
