import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAiOn } from '@/core/ai/switch';
import { isEntryUsable, useAiConfig } from '@/core/ai/config';
import { useUsageRows } from '@/core/ai/usage';
import { loadAutoLast, type AutoBackupLast } from '@/core/backup/auto';
import { formatNumber, formatTimestamp } from '@/core/i18n/format';
import { useModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { formatMuteEnd, useMute } from '@/core/notifications/mute';
import { getPlatform } from '@/core/platform';
import { useFocusSettings } from '@/core/settings/focus';
import { settingsPath } from '@/core/settings/registry/paths';
import type { SettingsCategoryId } from '@/core/settings/registry/types';
import { useSyncStatus } from '@/core/sync/status';
import { now } from '@/core/time/now';
import { useUpdateStore } from '@/core/update/controller';
import { loadAccountsSettings } from '@/modules/accounts/autolock';
import { useSession } from '@/modules/accounts/session';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tSettings2 } from '@/strings.settings2';
import { Icon, type IconName } from '@/ui';
import styles from './SettingsOverview.module.css';

interface CardProps {
  to: string;
  icon: IconName;
  title: string;
  /** The state in one line. */
  status: string;
  /** What the number means / what else is there, in one calm line. */
  context?: string;
  testId: string;
  /** `true` = something needs a look (a plain marker, never red). */
  attention?: boolean;
  children?: ReactNode;
}

function OverviewCard({ to, icon, title, status, context, testId, attention }: CardProps) {
  return (
    <li>
      <Link to={to} className={styles.card} data-testid={testId} data-attention={attention}>
        <span className={styles.head}>
          <span className={styles.icon}>
            <Icon name={icon} />
          </span>
          <span className={styles.title}>{title}</span>
        </span>
        <span className={styles.status}>{status}</span>
        {context ? <span className={styles.context}>{context}</span> : null}
      </Link>
    </li>
  );
}

const cat = (id: SettingsCategoryId) => t.settings.cat[id].title;

function LookCard() {
  const o = tSettings2.use().overview.look;
  const theme = useUiStore((s) => s.theme);
  const density = useUiStore((s) => s.density);
  return (
    <OverviewCard
      testId="overview-look"
      to="/settings/darstellung"
      icon="sun"
      title={cat('darstellung')}
      status={`${o.theme[theme]} · ${o.density[density]}`}
      context={o.context}
    />
  );
}

function SecurityCard() {
  const o = tSettings2.use().overview.security;
  const states = useModuleStates();
  const vaultOn = states?.accounts === true;
  const session = useSession((s) => s.session);
  const [minutes, setMinutes] = useState<string>();
  const [last, setLast] = useState<AutoBackupLast>();
  useEffect(() => {
    void loadAutoLast().then(setLast);
    if (vaultOn) void loadAccountsSettings().then((s) => setMinutes(s.autoLockMinutes));
  }, [vaultOn]);
  const backup = last?.ok ? o.backupAt(formatTimestamp(last.at)) : o.noBackup;
  const status = !vaultOn ? o.noVault : session.status === 'locked' ? o.locked : o.unlocked;
  const context = [vaultOn && minutes ? o.autoLock(minutes) : undefined, backup]
    .filter(Boolean)
    .join(' · ');
  return (
    <OverviewCard
      testId="overview-security"
      to={vaultOn ? '/settings/sicherheit' : settingsPath('sync', 'backup')}
      icon="lock"
      title={cat('sicherheit')}
      status={status}
      context={context}
    />
  );
}

function SyncCard() {
  const o = tSettings2.use().overview.sync;
  const s = useSyncStatus();
  const status =
    s.phase === 'off'
      ? o.off
      : s.phase === 'syncing'
        ? o.syncing
        : s.phase === 'error'
          ? o.error
          : o.on;
  const context =
    s.phase === 'off'
      ? o.offContext
      : [
          s.lastSyncAt ? o.lastAt(formatTimestamp(s.lastSyncAt)) : o.never,
          s.serverStats ? o.devices(s.serverStats.devices) : undefined,
        ]
          .filter(Boolean)
          .join(' · ');
  return (
    <OverviewCard
      testId="overview-sync"
      to="/settings/sync"
      icon="sync"
      title={cat('sync')}
      status={status}
      context={context}
      attention={s.phase === 'error'}
    />
  );
}

function AiCard() {
  const o = tSettings2.use().overview.ai;
  const aiOn = useAiOn();
  const config = useAiConfig();
  const rows = useUsageRows();
  const providers = config ? config.providers.filter(isEntryUsable).length : 0;
  const since = new Date(now()).setHours(0, 0, 0, 0);
  const tokens = (rows ?? [])
    .filter((r) => r.at >= since)
    .reduce((n, r) => n + r.inputTokens + r.outputTokens, 0);
  const status = !aiOn ? o.off : providers === 0 ? o.none : o.providers(providers);
  const context =
    !aiOn || providers === 0
      ? undefined
      : tokens > 0
        ? o.tokensToday(formatNumber(tokens))
        : o.noTokens;
  return (
    <OverviewCard
      testId="overview-ai"
      to="/settings/ki"
      icon="sparkles"
      title={cat('ki')}
      status={status}
      context={context}
    />
  );
}

function NotificationsCard() {
  const o = tSettings2.use().overview.notifications;
  const [focus] = useFocusSettings();
  const mute = useMute();
  const allowed = getPlatform().notifications.permission() === 'granted';
  const quiet = focus.quietHours ? o.quiet(focus.quietFrom, focus.quietTo) : o.quietOff;
  return (
    <OverviewCard
      testId="overview-notifications"
      to="/settings/benachrichtigungen"
      icon="bell"
      title={cat('benachrichtigungen')}
      status={allowed ? o.allowed : o.notAllowed}
      context={mute ? o.muted(formatMuteEnd(mute.until)) : quiet}
    />
  );
}

function UpdatesCard() {
  const o = tSettings2.use().overview.updates;
  const available = useUpdateStore((u) => u.state.phase === 'available');
  const [version, setVersion] = useState('');
  useEffect(() => {
    void getPlatform().app.version().then(setVersion);
  }, []);
  return (
    <OverviewCard
      testId="overview-updates"
      to="/settings/updates"
      icon="download"
      title={cat('updates')}
      status={available ? o.available : o.current}
      context={version ? o.version(version) : undefined}
      attention={available}
    />
  );
}

function StorageCard() {
  const o = tSettings2.use().overview.storage;
  const [used, setUsed] = useState<number | null>();
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return;
    void navigator.storage.estimate().then(
      (e) => setUsed(e.usage ?? null),
      () => setUsed(null),
    );
  }, []);
  const mb = used ? used / (1024 * 1024) : 0;
  const size = `${formatNumber(mb, { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
  return (
    <OverviewCard
      testId="overview-storage"
      to={settingsPath('allgemein', 'recently-deleted')}
      icon="disk"
      title={o.title}
      status={used ? o.used(size) : o.unknown}
      context={o.context}
    />
  );
}

function ModulesCard() {
  const o = tSettings2.use().overview.modules;
  const states = useModuleStates();
  const total = availableManifests().length;
  const active = states ? Object.values(states).filter(Boolean).length : 0;
  return (
    <OverviewCard
      testId="overview-modules"
      to="/settings/module"
      icon="grid"
      title={cat('module')}
      status={o.active(active, total)}
      context={o.context}
    />
  );
}

/** `/settings`: eight cards, each with the state in one line and a jump into its category. */
export function SettingsOverview() {
  const o = tSettings2.use().overview;
  return (
    <section aria-label={o.title} data-testid="settings-overview">
      <ul className={styles.grid}>
        <LookCard />
        <SecurityCard />
        <SyncCard />
        <AiCard />
        <NotificationsCard />
        <UpdatesCard />
        <StorageCard />
        <ModulesCard />
      </ul>
    </section>
  );
}
