import {
  clearVaultEntry,
  HANDOFF_PARAM,
  peekVaultEntry,
  vaultEntryVersion,
} from '@/core/handoff/vaultEntry';
import { compareText } from '@/core/i18n/format';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import {
  Badge,
  Button,
  Chip,
  Chips,
  EmptyState,
  Icon,
  ItemList,
  ItemRow,
  PageHeader,
  SplitView,
  TextField,
  useSplitView,
} from '@/ui';
import { BridgeDialog, PairingDialog } from '../components/BridgeDialog';
import { AuditDialog } from '../components/AuditDialog';
import { EmergencySheet } from '../components/EmergencySheet';
import { EntryDetail, EntryPanel } from '../components/EntryDetail';
import { MonogramTile } from '../components/MonogramTile';
import { VaultDoor } from '../components/VaultDoor';
import { useBridgeConfig } from '@/core/vaultbridge/config';
import { EntryForm, type EntryTarget } from '../components/EntryForm';
import { GeneratorDialog } from '../components/GeneratorDialog';
import { LockScreen } from '../components/LockScreen';
import { SetupScreen } from '../components/SetupScreen';
import { ToolsDialog } from '../components/ToolsDialog';
import { useEntries, useHeaderState } from '../hooks';
import { useSession } from '../session';
import { preloadStrength } from '../strength';
import { deleteEntry, lockVault, type DecryptedEntry } from '../vault';
import styles from '../accounts.module.css';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function searchEntries(
  entries: readonly DecryptedEntry[],
  query: string,
  group: string = 'all',
): DecryptedEntry[] {
  entries = entries.filter(
    (e) => group === 'all' || (group === '*fav' ? e.data.favorite : e.data.tags.includes(group)),
  );
  const q = fold(query.trim());
  const shown = q
    ? entries.filter((e) => {
        const d = e.data;
        return fold([d.title, d.username, d.url, d.notes, ...d.tags].join('\n')).includes(q);
      })
    : [...entries];
  return shown.sort(
    (a, b) =>
      Number(b.data.favorite) - Number(a.data.favorite) || compareText(a.data.title, b.data.title),
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

  // The strength dictionaries are not precached: fetch them once in the background (offline later).
  useEffect(() => {
    const timer = setTimeout(preloadStrength, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!header) return <PageHeader title={t.accounts.title} />;
  return (
    <>
      {header.state === 'ready' ? <VaultDoor unlocked={session.status === 'unlocked'} /> : null}
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
  // `?handoff=1`: a tool (anonymous persona) handed over a new entry; the form opens with it filled in. It is
  // only read here (and forgotten right below), never stored; saving works like for any entry. Also works when
  // this page is already open: a new offer has a new version.
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState<EntryTarget>(null);
  const [takenVersion, setTakenVersion] = useState(-1);
  const handoffFlag = params.get(HANDOFF_PARAM) === '1';
  const handed = handoffFlag ? peekVaultEntry() : undefined;
  if (handed && vaultEntryVersion() !== takenVersion) {
    setTakenVersion(vaultEntryVersion());
    setForm({ draft: true, prefill: handed });
  }
  useEffect(() => {
    if (!handoffFlag) return;
    clearVaultEntry();
    const next = new URLSearchParams(params);
    next.delete(HANDOFF_PARAM);
    setParams(next, { replace: true });
  }, [handoffFlag, params, setParams]);
  // `?tools=1` (setup "Umzug": Bitwarden): open import & export right away.
  const [tools, setTools] = useState(params.get('tools') === '1');
  const [generator, setGenerator] = useState(false);
  const [bridge, setBridge] = useState(false);
  const [audit, setAudit] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [group, setGroup] = useState('all');
  const bridgeConfig = useBridgeConfig();
  const searchBox = useRef<HTMLInputElement>(null);
  // `?find=n` (vault search key): focus the search field.
  const find = params.get('find');
  useEffect(() => {
    if (find) searchBox.current?.focus();
  }, [find]);
  // Wide screens: list and detail side by side (same detail content, just not in a dialog).
  const panel = useSplitView();

  const shown = useMemo(
    () => searchEntries(data?.entries ?? [], query, group),
    [data, query, group],
  );
  const tags = useMemo(
    () => [...new Set((data?.entries ?? []).flatMap((e) => e.data.tags))].sort(compareText),
    [data],
  );
  const hasFavorites = (data?.entries ?? []).some((e) => e.data.favorite);
  const detail = data?.entries.find((e) => e.id === detailId) ?? null;

  if (!data) return null;
  return (
    <>
      <div
        className={`${styles.inline} ${styles.toolbar}`}
        style={{ marginBottom: 'var(--space-4)' }}
      >
        <TextField
          label={t.accounts.search}
          type="search"
          ref={searchBox}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button variant="primary" onClick={() => setForm({ draft: true })}>
          <Icon name="plus" size={18} />
          {t.accounts.add}
        </Button>
        <Button onClick={() => setGenerator(true)}>{t.accounts.generator.newPassword}</Button>
        <Button onClick={() => setTools(true)}>{t.accounts.tools.open}</Button>
        <Button onClick={() => setAudit(true)}>{t.accounts.audit.open}</Button>
        <Button onClick={() => setEmergency(true)}>{t.accounts.emergency.open}</Button>
        {getPlatform().vaultBridge.supported ? (
          <>
            <Button onClick={() => setBridge(true)}>{t.accounts.bridge.open}</Button>
            <Badge tone={bridgeConfig?.enabled ? 'success' : 'neutral'}>
              {bridgeConfig?.enabled ? t.accounts.head.bridgeOn : t.accounts.head.bridgeOff}
            </Badge>
          </>
        ) : null}
      </div>
      {tags.length > 0 || hasFavorites ? (
        <Chips label={t.accounts.groups.label}>
          <Chip
            label={t.accounts.groups.all}
            selected={group === 'all'}
            onClick={() => setGroup('all')}
          />
          {hasFavorites ? (
            <Chip
              label={t.accounts.groups.favorites}
              selected={group === '*fav'}
              onClick={() => setGroup('*fav')}
            />
          ) : null}
          {tags.map((tag) => (
            <Chip key={tag} label={tag} selected={group === tag} onClick={() => setGroup(tag)} />
          ))}
        </Chips>
      ) : null}
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
            <EmptyState title={t.accounts.pickEntry} />
          )
        }
      >
        {shown.length === 0 ? (
          <EmptyState
            title={data.entries.length === 0 ? t.accounts.empty : t.accounts.emptyFiltered}
          />
        ) : null}
        <ItemList label={t.accounts.title}>
          {shown.map((e) => (
            <ItemRow
              key={e.id}
              title={e.data.title}
              lead={<MonogramTile title={e.data.title} />}
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
      <AuditDialog
        open={audit}
        onClose={() => setAudit(false)}
        entries={data.entries}
        onOpenEntry={setDetailId}
      />
      <EmergencySheet
        open={emergency}
        onClose={() => setEmergency(false)}
        entryCount={data.entries.length}
        onBackup={() => setTools(true)}
      />
      <BridgeDialog open={bridge} onClose={() => setBridge(false)} />
      <PairingDialog />
      <ToolsDialog open={tools} onClose={() => setTools(false)} entries={data.entries} />
    </>
  );
}
