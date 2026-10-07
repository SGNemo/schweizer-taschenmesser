import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAiOn } from '@/core/ai/switch';
import { useSettings } from '@/core/settings/settings';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { Badge, Button, EmptyState, Icon, PageHeader, TextField } from '@/ui';
import { ThreadView } from '../components/ThreadView';
import { expiredThreads, searchThreads, sortThreads } from '../logic';
import { messageRepo, threadRepo } from '../repo';
import { settings } from '../settings';
import styles from '../chat.module.css';

const c = t.chat;

export default function ChatPage() {
  const [params, setParams] = useSearchParams();
  const [prefs] = useSettings('module.chat', settings.schema, settings.defaults);
  const aiOn = useAiOn();
  const threads = useLiveQuery(() => threadRepo.active().toArray(), []);
  const messages = useLiveQuery(() => messageRepo.active().toArray(), []);
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const creating = useRef(false);
  const selected = params.get('t');
  const keepDays = Number((prefs as { keepDays?: string } | undefined)?.keepDays ?? 0);
  const defaultEngine =
    (prefs as { defaultEngine?: 'local' | 'router' } | undefined)?.defaultEngine ?? 'router';

  // Old, unpinned chats go when the module is opened (setting "Alte Chats löschen nach").
  useEffect(() => {
    if (!threads || !messages || keepDays <= 0) return;
    const old = expiredThreads(threads, keepDays, now());
    if (old.length === 0) return;
    const ids = new Set(old.map((x) => x.id));
    void messageRepo.removeMany(messages.filter((m) => ids.has(m.threadId)).map((m) => m.id));
    void threadRepo.removeMany([...ids]);
  }, [threads, messages, keepDays]);

  async function create() {
    const row = await threadRepo.create({
      title: c.newChat,
      autoTitle: true,
      pinned: false,
      archived: false,
      engine: defaultEngine,
      contextModules: [],
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    });
    setParams({ t: row.id }, { replace: false });
  }

  // `?new=1` (quick add) starts a chat.
  useEffect(() => {
    if (params.get('new') && threads && prefs && !creating.current) {
      creating.current = true;
      void create().finally(() => {
        creating.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('new'), Boolean(threads), Boolean(prefs)]);

  const shown = useMemo(
    () =>
      sortThreads(
        searchThreads(
          (threads ?? []).filter((x) => x.archived === archived),
          messages ?? [],
          query,
        ),
      ),
    [threads, messages, query, archived],
  );

  if (!aiOn) {
    return (
      <>
        <PageHeader title={c.title} />
        <EmptyState title={c.aiOff} />
      </>
    );
  }

  if (selected && threads?.some((x) => x.id === selected)) {
    return <ThreadView threadId={selected} onBack={() => setParams({}, { replace: true })} />;
  }

  return (
    <>
      <PageHeader title={c.title}>
        <Button variant="primary" onClick={() => void create()}>
          <Icon name="plus" size={18} />
          {c.newChat}
        </Button>
      </PageHeader>
      <div className={styles.layout}>
        <TextField
          label={c.search}
          labelHidden
          placeholder={c.search}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />{' '}
          {c.showArchived}
        </label>
        {threads && shown.length === 0 ? (
          <EmptyState title={c.empty}>
            <Button variant="primary" onClick={() => void create()}>
              {c.emptyAction}
            </Button>
          </EmptyState>
        ) : (
          <ul className={styles.list}>
            {shown.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  className={styles.threadBtn}
                  onClick={() => setParams({ t: x.id })}
                >
                  {x.pinned ? <Icon name="pin" size={16} /> : null}
                  <span className={styles.threadTitle}>{x.title}</span>
                  <Badge tone="neutral">
                    {x.engine === 'local' ? c.engineLocal : c.engineRouter}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
