import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAiOn } from '@/core/ai/switch';
import { useSettings } from '@/core/settings/settings';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  Icon,
  ItemList,
  ItemRow,
  PageAction,
  PageHeader,
  TextField,
} from '@/ui';
import { SignatureMark } from '@/ui/identity';
import { SetupHint, useChatSetup } from '../components/SetupHint';
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
  const setup = useChatSetup();
  const threads = useLiveQuery(() => threadRepo.active().toArray(), []);
  const messages = useLiveQuery(() => messageRepo.active().toArray(), []);
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const creating = useRef(false);
  const selected = params.get('t');
  const keepDays = Number((prefs as { keepDays?: string } | undefined)?.keepDays ?? 0);
  const defaultEngine =
    (prefs as { defaultEngine?: 'local' | 'router' } | undefined)?.defaultEngine ?? 'router';

  // comfort-allow-delete: retention clean-up, not a user delete.
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

  // Nothing here at all (not: a search without a hit, or an empty archive).
  const isEmpty = !!threads && threads.length === 0;

  if (!aiOn) {
    return (
      <>
        <PageHeader title={c.title} />
        <EmptyState
          title={c.aiOff}
          testId="chat-empty"
          motif={<SignatureMark id="bubble" size={64} />}
        />
      </>
    );
  }

  if (selected && threads?.some((x) => x.id === selected)) {
    return (
      <>
        <SetupHint setup={setup} />
        <ThreadView threadId={selected} onBack={() => setParams({}, { replace: true })} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={c.title}>
        {/* One filled action per page (C23): while the setup hint shows, it is that one and this steps back. */}
        <PageAction
          short={t.nav.plusThings.chat}
          variant={setup?.needed || isEmpty ? 'secondary' : 'primary'}
          // No AI yet: a new chat could not answer, so the set-up hint is the one step (on the phone the plus is the
          // page's action and would be a second filled button beside the hint).
          disabled={setup?.needed === true}
          onClick={() => void create()}
        >
          <Icon name="plus" size={18} />
          {c.newChat}
        </PageAction>
      </PageHeader>
      <SetupHint setup={setup} />
      <div className={styles.layout} data-after-hint={setup?.needed ? '' : undefined}>
        <TextField
          label={c.search}
          labelHidden
          placeholder={c.search}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Checkbox
          label={c.showArchived}
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
        />
        {threads && shown.length === 0 ? (
          // No chat yet: one verb. While the set-up hint shows, that one is the next step and this stays a title.
          <EmptyState
            title={c.empty}
            testId="chat-empty"
            motif={<SignatureMark id="bubble" size={64} />}
          >
            {isEmpty && !setup?.needed ? (
              <Button variant="primary" onClick={() => void create()}>
                {c.newChat}
              </Button>
            ) : null}
          </EmptyState>
        ) : (
          <ItemList label={c.title}>
            {shown.map((x) => (
              <ItemRow
                key={x.id}
                title={x.title}
                lead={x.pinned ? <Icon name="pin" size={16} /> : undefined}
                end={
                  <Badge tone="neutral">
                    {x.engine === 'local' ? c.engineLocal : c.engineRouter}
                  </Badge>
                }
                onOpen={() => setParams({ t: x.id })}
              />
            ))}
          </ItemList>
        )}
      </div>
    </>
  );
}
