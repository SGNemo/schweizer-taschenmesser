import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listMailAccounts } from '@/core/mail/accounts';
import { mailLabels } from '@/core/mail/service';
import type { MailAccountRef, MailLabel } from '@/core/mail/types';
import { useSettings } from '@/core/settings/settings';
import { settingsPath } from '@/core/settings/registry/paths';
import { t } from '@/strings';
import {
  Button,
  EmptyState,
  GroupedList,
  Icon,
  IconButton,
  ItemList,
  ItemRow,
  PageHeader,
  SelectField,
  Skeleton,
  TextField,
  useMediaQuery,
  type GroupedListGroup,
  type RowMenuItem,
} from '@/ui';
import { HeroSlot } from '@/ui/identity';
import { DEMO_ACCOUNT, type CachedThreadView } from '../cache';
import { MailError } from '../components/MailError';
import { MailSettingsPanel } from '../components/MailSettingsPanel';
import { Stamp } from '../components/Stamp';
import { ComposeDialog } from '../components/ComposeDialog';
import { PendingSendBar } from '../components/PendingSendBar';
import { ThreadView } from '../components/ThreadView';
import { emptyCompose, type ComposeState } from '../composeState';
import { hasFeature } from '@/core/mail/service';
import styles from '../components/mail.module.css';
import { dayGroup, personName, shortWhen, subjectOf, type DayGroup } from '../format';
import { threadRepo } from '../repo';
import { settings } from '../settings';
import { rowAction } from '../rowActions';
import { readSearches, rememberSearch, suggestionsFor } from '../searchHistory';
import { useMailbox } from '../useMailbox';
import { useMailSummary } from '../useSummary';

const GROUPS: DayGroup[] = ['today', 'yesterday', 'week', 'older'];
const DEFAULT_LABELS: MailLabel[] = ['INBOX', 'STARRED', 'IMPORTANT', 'SENT'].map((id) => ({
  id,
  name: id,
  kind: 'system',
}));

const labelName = (l: MailLabel) => t.mail.page.labels[l.id] ?? l.name;

function ThreadList({
  threads,
  onOpen,
  menuFor,
}: {
  threads: CachedThreadView[];
  onOpen: (id: string) => void;
  /** Quick actions of one row (read/unread, archive); none without write permission. */
  menuFor?: (th: CachedThreadView) => RowMenuItem[];
}) {
  const groups: GroupedListGroup[] = GROUPS.map((g) => {
    const rows = threads.filter((th) => dayGroup(th.date) === g);
    return {
      id: g,
      label: t.mail.page.groups[g],
      count: rows.length,
      children: (
        <ItemList>
          {rows.map((th) => (
            <ItemRow
              key={th.id}
              title={
                <span className={th.unread ? styles.unreadRow : styles.rowFrom}>
                  {personName(th.from)}
                  {th.messageCount > 1 ? ` (${th.messageCount})` : ''}
                </span>
              }
              meta={
                <>
                  <span className={th.unread ? styles.unreadRow : undefined}>
                    {subjectOf(th.subject)}
                  </span>
                  {th.snippet ? <span className={styles.snippet}> – {th.snippet}</span> : null}
                </>
              }
              end={<span className={styles.meta}>{shortWhen(th.date)}</span>}
              onOpen={() => onOpen(th.id)}
              menu={menuFor?.(th)}
            />
          ))}
        </ItemList>
      ),
    };
  }).filter((g) => g.count > 0);
  return <GroupedList listId="mail" groups={groups} />;
}

export default function MailPage() {
  const [params, setParams] = useSearchParams();
  const [prefs] = useSettings('module.mail', settings.schema, settings.defaults);
  const live = useLiveQuery(() => listMailAccounts(), []);
  const demoCount = useLiveQuery(
    () =>
      threadRepo
        .active()
        .filter((r) => r.accountKey === DEMO_ACCOUNT)
        .count(),
    [],
  );
  const accounts: MailAccountRef[] = useMemo(() => {
    if (!live) return [];
    if (live.length > 0) return live;
    return demoCount ? [{ key: DEMO_ACCOUNT, connectorId: 'demo' }] : [];
  }, [live, demoCount]);

  const account = accounts.find((a) => a.key === params.get('account')) ?? accounts[0];
  const labelId = params.get('label') ?? 'INBOX';
  const query = params.get('q') ?? '';
  const threadId = params.get('thread');
  const [draft, setDraft] = useState(query);
  const [seenQuery, setSeenQuery] = useState(query);
  if (seenQuery !== query) {
    // the address changed (search ended, link followed): the field follows
    setSeenQuery(query);
    setDraft(query);
  }
  const [panel, setPanel] = useState(false);
  const [compose, setCompose] = useState<
    { state: ComposeState; title: string; account: MailAccountRef } | undefined
  >();
  const [fetched, setFetched] = useState<{ key: string; labels: MailLabel[] } | undefined>();
  const labels =
    account && fetched?.key === account.key && account.key !== DEMO_ACCOUNT
      ? fetched.labels
      : DEFAULT_LABELS;

  const box = useMailbox(account, labelId, query);
  const wide = useMediaQuery('(min-width: 1200px)');
  const summary = useMailSummary();
  const [recent, setRecent] = useState<string[]>(readSearches);
  const senders = useMemo(
    () => [...new Set(box.threads.map((th) => personName(th.from)))],
    [box.threads],
  );
  const suggestions = suggestionsFor(draft, recent, senders);
  const images = (prefs as { images?: string } | undefined)?.images === 'always';
  const cacheBodies = (prefs as { cacheBodies?: boolean } | undefined)?.cacheBodies ?? true;
  const confirmMoves = (prefs as { confirmMoves?: boolean } | undefined)?.confirmMoves ?? true;
  const localAi = (prefs as { localAi?: boolean } | undefined)?.localAi ?? false;

  useEffect(() => {
    if (!account || account.key === DEMO_ACCOUNT) return;
    let alive = true;
    void mailLabels(account)
      .then((l) => alive && setFetched({ key: account.key, labels: l }))
      .catch(() => undefined); // the standard folders stay
    return () => {
      alive = false;
    };
  }, [account]);

  function update(next: Record<string, string | null>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    setParams(p);
  }

  const canWrite =
    !!account && (hasFeature(account, 'mail-send') || hasFeature(account, 'mail-modify'));
  const header = (
    <>
      {summary ? (
        <HeroSlot area="figure">
          <Stamp
            count={summary.unread}
            label={t.mail.widget.unread}
            context={t.mail.widget.unreadContext(summary.unread)}
          />
        </HeroSlot>
      ) : null}
      <PageHeader title={t.mail.meta.name}>
        {canWrite && account ? (
          <Button
            onClick={() =>
              setCompose({ state: emptyCompose(), title: t.mail.write.compose.titleNew, account })
            }
          >
            {t.mail.write.newMail}
          </Button>
        ) : null}
        <IconButton label={t.mail.page.settings} onClick={() => setPanel(true)}>
          <Icon name="settings" />
        </IconButton>
      </PageHeader>
    </>
  );

  if (live && accounts.length === 0)
    return (
      <>
        {header}
        <EmptyState title={t.mail.connect.title}>
          <p>{t.mail.connect.body}</p>
          <Link to={settingsPath('verbindungen', 'connectors')}>{t.mail.connect.action}</Link>
        </EmptyState>
        <MailSettingsPanel open={panel} onClose={() => setPanel(false)} />
      </>
    );
  if (!account)
    return (
      <>
        {header}
        <Skeleton height="8rem" />
      </>
    );

  const writeUi = (
    <>
      <PendingSendBar
        onReopen={(state, acc) =>
          setCompose({ state, title: t.mail.write.compose.titleNew, account: acc })
        }
      />
      {compose ? (
        <ComposeDialog
          account={compose.account}
          initial={compose.state}
          title={compose.title}
          onClose={() => setCompose(undefined)}
        />
      ) : null}
    </>
  );

  const threadView = threadId ? (
    <ThreadView
      key={`${account.key}|${threadId}`}
      account={account}
      threadId={threadId}
      cacheBodies={cacheBodies}
      autoLoadImages={images}
      labels={labels}
      confirmMoves={confirmMoves}
      localAi={localAi}
      onChanged={box.reload}
      onCompose={(state, title) => setCompose({ state, title, account })}
      onBack={() => update({ thread: null })}
    />
  ) : null;

  // Phone and narrow windows: the mail replaces the list. From 1200 px both stay (see below).
  if (threadId && !wide)
    return (
      <>
        {header}
        {writeUi}
        {threadView}
        <MailSettingsPanel open={panel} onClose={() => setPanel(false)} />
      </>
    );

  const canModify = hasFeature(account, 'mail-modify');
  const menuFor = canModify
    ? (th: (typeof box.threads)[number]): RowMenuItem[] => [
        th.unread
          ? {
              id: 'read',
              label: t.mail.page.rowRead,
              onSelect: () => void rowAction(account, th.id, 'read', box.reload),
            }
          : {
              id: 'unread',
              label: t.mail.page.rowUnread,
              onSelect: () => void rowAction(account, th.id, 'unread', box.reload),
            },
        ...(th.labelIds.includes('INBOX')
          ? [
              {
                id: 'archive',
                label: t.mail.page.rowArchive,
                onSelect: () => void rowAction(account, th.id, 'archive', box.reload),
              },
            ]
          : []),
      ]
    : undefined;

  const listPane = (
    <>
      {account.key === DEMO_ACCOUNT ? <p className={styles.notice}>{t.mail.page.demo}</p> : null}
      <form
        className={styles.toolbar}
        onSubmit={(e) => {
          e.preventDefault();
          setRecent(rememberSearch(draft));
          update({ q: draft.trim(), thread: null });
        }}
        role="search"
      >
        {accounts.length > 1 ? (
          <div className={styles.picker}>
            <SelectField
              label={t.mail.page.account}
              value={account.key}
              onChange={(e) => update({ account: e.target.value, thread: null })}
            >
              {accounts.map((a, i) => (
                <option key={a.key} value={a.key}>
                  {a.email ?? t.mail.page.accountN(i + 1)}
                </option>
              ))}
            </SelectField>
          </div>
        ) : null}
        {wide ? null : (
          <div className={styles.picker}>
            <SelectField
              label={t.mail.page.label}
              value={labelId}
              disabled={query !== ''}
              onChange={(e) => update({ label: e.target.value })}
            >
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {labelName(l)}
                  {l.unread ? ` (${l.unread})` : ''}
                </option>
              ))}
            </SelectField>
          </div>
        )}
        <div className={styles.search}>
          <TextField
            label={t.mail.page.searchLabel}
            hint={t.mail.page.searchHint}
            placeholder={t.mail.page.searchPlaceholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            list="mail-suggest"
            autoComplete="off"
          />
          <datalist id="mail-suggest">
            {suggestions.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </div>
        <Button type="submit" variant="primary">
          {t.mail.page.searchLabel}
        </Button>
        {query ? (
          <Button onClick={() => update({ q: null })}>{t.mail.page.searchEnd}</Button>
        ) : null}
        <Button onClick={box.reload} disabled={box.loading}>
          {t.mail.page.refresh}
        </Button>
      </form>

      {box.error ? <MailError code={box.error} /> : null}
      {box.fromCache ? <p className={styles.hint}>{t.mail.page.cached}</p> : null}

      {box.threads.length === 0 && box.loading ? (
        <Skeleton height="10rem" />
      ) : box.threads.length === 0 && !box.error ? (
        <EmptyState title={query ? t.mail.page.emptySearch : t.mail.page.empty} />
      ) : (
        <ThreadList
          threads={box.threads}
          onOpen={(id) => update({ thread: id })}
          menuFor={menuFor}
        />
      )}
      {box.hasMore ? (
        <div className={styles.row}>
          <Button onClick={box.loadMore} disabled={box.loading}>
            {t.mail.page.more}
          </Button>
        </div>
      ) : null}
    </>
  );

  return (
    <>
      {header}
      {writeUi}
      {wide ? (
        <div className={styles.cols} data-testid="mail-columns">
          <nav className={styles.labelCol} aria-label={t.mail.page.labelsNav}>
            {labels.map((l) => (
              <button
                key={l.id}
                type="button"
                className={styles.labelBtn}
                aria-current={l.id === labelId && !query ? 'true' : undefined}
                onClick={() => update({ label: l.id, q: null, thread: null })}
              >
                <span>{labelName(l)}</span>
                {l.unread ? <span className={styles.labelCount}>{l.unread}</span> : null}
              </button>
            ))}
          </nav>
          <div className={styles.listCol}>{listPane}</div>
          <section className={styles.reading} aria-label={t.mail.view.back}>
            {threadView ?? <p className={styles.hint}>{t.mail.page.pickThread}</p>}
          </section>
        </div>
      ) : (
        listPane
      )}
      <MailSettingsPanel open={panel} onClose={() => setPanel(false)} />
    </>
  );
}
