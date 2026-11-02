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
  type GroupedListGroup,
} from '@/ui';
import { DEMO_ACCOUNT, type CachedThreadView } from '../cache';
import { MailError } from '../components/MailError';
import { MailSettingsPanel } from '../components/MailSettingsPanel';
import { ThreadView } from '../components/ThreadView';
import styles from '../components/mail.module.css';
import { dayGroup, personName, shortWhen, subjectOf, type DayGroup } from '../format';
import { threadRepo } from '../repo';
import { settings } from '../settings';
import { useMailbox } from '../useMailbox';

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
}: {
  threads: CachedThreadView[];
  onOpen: (id: string) => void;
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
  const [fetched, setFetched] = useState<{ key: string; labels: MailLabel[] } | undefined>();
  const labels =
    account && fetched?.key === account.key && account.key !== DEMO_ACCOUNT
      ? fetched.labels
      : DEFAULT_LABELS;

  const box = useMailbox(account, labelId, query);
  const images = (prefs as { images?: string } | undefined)?.images === 'always';
  const cacheBodies = (prefs as { cacheBodies?: boolean } | undefined)?.cacheBodies ?? true;

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

  const header = (
    <PageHeader title={t.mail.meta.name}>
      <IconButton label={t.mail.page.settings} onClick={() => setPanel(true)}>
        <Icon name="settings" />
      </IconButton>
    </PageHeader>
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

  if (threadId)
    return (
      <>
        {header}
        <ThreadView
          key={`${account.key}|${threadId}`}
          account={account}
          threadId={threadId}
          cacheBodies={cacheBodies}
          autoLoadImages={images}
          onBack={() => update({ thread: null })}
        />
        <MailSettingsPanel open={panel} onClose={() => setPanel(false)} />
      </>
    );

  return (
    <>
      {header}
      {account.key === DEMO_ACCOUNT ? <p className={styles.notice}>{t.mail.page.demo}</p> : null}
      <form
        className={styles.toolbar}
        onSubmit={(e) => {
          e.preventDefault();
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
        <div className={styles.search}>
          <TextField
            label={t.mail.page.searchLabel}
            hint={t.mail.page.searchHint}
            placeholder={t.mail.page.searchPlaceholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
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
        <ThreadList threads={box.threads} onOpen={(id) => update({ thread: id })} />
      )}
      {box.hasMore ? (
        <div className={styles.row}>
          <Button onClick={box.loadMore} disabled={box.loading}>
            {t.mail.page.more}
          </Button>
        </div>
      ) : null}
      <MailSettingsPanel open={panel} onClose={() => setPanel(false)} />
    </>
  );
}
