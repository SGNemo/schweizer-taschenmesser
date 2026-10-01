import { useEffect, useMemo, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import {
  Button,
  EmptyState,
  Icon,
  ItemList,
  ItemRow,
  PageHeader,
  SplitView,
  TextField,
  useSplitView,
} from '@/ui';
import { EntryDetail, EntryPanel } from '../components/EntryDetail';
import { EntryForm, type EntryTarget } from '../components/EntryForm';
import { GeneratorDialog } from '../components/GeneratorDialog';
import { LockScreen } from '../components/LockScreen';
import { SetupScreen } from '../components/SetupScreen';
import { ToolsDialog } from '../components/ToolsDialog';
import { useEntries, useHeaderState } from '../hooks';
import { useSession } from '../session';
import { deleteEntry, lockVault, type DecryptedEntry } from '../vault';
import styles from '../accounts.module.css';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function searchEntries(entries: readonly DecryptedEntry[], query: string): DecryptedEntry[] {
  const q = fold(query.trim());
  const shown = q
    ? entries.filter((e) => {
        const d = e.data;
        return fold([d.title, d.username, d.url, d.notes, ...d.tags].join('\n')).includes(q);
      })
    : [...entries];
  return shown.sort(
    (a, b) =>
      Number(b.data.favorite) - Number(a.data.favorite) ||
      a.data.title.localeCompare(b.data.title, 'de'),
  );
}

export default function AccountsPage() {
  const header = useHeaderState();
  const session = useSession((s) => s.session);

  // No screenshots / app-switcher preview of the vault (Android FLAG_SECURE; a no-op elsewhere).
  useEffect(() => {
    const { screen } = getPlatform();
    void screen.setSecure(true);
    return () => void screen.setSecure(false);
  }, []);

  if (!header) return <PageHeader title={t.accounts.title} />;
  return (
    <>
      <PageHeader title={t.accounts.title}>
        {session.status === 'unlocked' ? (
          <Button onClick={lockVault}>
            <Icon name="lock" size={18} />
            {t.accounts.lock.lockNow}
          </Button>
        ) : null}
      </PageHeader>
      {header.state === 'none' ? <SetupScreen /> : null}
      {header.state === 'corrupt' ? <p role="alert">{t.accounts.lock.corrupt}</p> : null}
      {header.state === 'ready' && session.status === 'locked' ? <LockScreen /> : null}
      {header.state === 'ready' && session.status === 'unlocked' ? <Unlocked /> : null}
    </>
  );
}

function Unlocked() {
  const data = useEntries();
  const [query, setQuery] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<EntryTarget>(null);
  const [tools, setTools] = useState(false);
  const [generator, setGenerator] = useState(false);
  // Wide screens: list and detail side by side (same detail content, just not in a dialog).
  const panel = useSplitView();

  const shown = useMemo(() => searchEntries(data?.entries ?? [], query), [data, query]);
  const detail = data?.entries.find((e) => e.id === detailId) ?? null;

  if (!data) return null;
  return (
    <>
      <div className={styles.inline} style={{ marginBottom: 'var(--space-4)' }}>
        <TextField
          label={t.accounts.search}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button variant="primary" onClick={() => setForm({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.accounts.add}
        </Button>
        <Button onClick={() => setGenerator(true)}>{t.accounts.generator.newPassword}</Button>
        <Button onClick={() => setTools(true)}>{t.accounts.tools.open}</Button>
      </div>
      {data.broken.length > 0 ? (
        <div className={styles.banner} role="status">
          <p>{t.accounts.undecryptable(data.broken.length)}</p>
          <Button
            variant="danger"
            onClick={() => void Promise.all(data.broken.map((b) => deleteEntry(b.id)))}
          >
            {t.accounts.removeBroken}
          </Button>
        </div>
      ) : null}
      <SplitView
        enabled={panel}
        asideLabel={t.accounts.detail}
        aside={
          detail ? (
            <EntryPanel
              entry={detail}
              onClose={() => setDetailId(null)}
              onEdit={(entry) => setForm(entry)}
            />
          ) : (
            <EmptyState icon="lock" title={t.accounts.pickEntry} />
          )
        }
      >
        {shown.length === 0 ? (
          <EmptyState
            icon="lock"
            title={data.entries.length === 0 ? t.accounts.empty : t.accounts.emptyFiltered}
          />
        ) : null}
        <ItemList label={t.accounts.title}>
          {shown.map((e) => (
            <ItemRow
              key={e.id}
              title={e.data.title}
              meta={e.data.username || undefined}
              onOpen={() => setDetailId(e.id)}
            />
          ))}
        </ItemList>
      </SplitView>
      <EntryDetail
        entry={panel ? null : detail}
        onClose={() => setDetailId(null)}
        onEdit={(entry) => {
          setDetailId(null);
          setForm(entry);
        }}
      />
      <EntryForm target={form} onClose={() => setForm(null)} onSaved={(id) => setDetailId(id)} />
      <GeneratorDialog
        open={generator}
        onClose={() => setGenerator(false)}
        onSaveAs={(password) => {
          setGenerator(false);
          setForm({ draft: true, password });
        }}
      />
      <ToolsDialog open={tools} onClose={() => setTools(false)} entries={data.entries} />
    </>
  );
}
