import { useAiOn } from '@/core/ai/switch';
import { useLiveQuery } from 'dexie-react-hooks';
import { isEntryUsable, useAiConfig } from '@/core/ai/config';
import { useModuleStates } from '@/core/modules/activation';
import { getPlatform } from '@/core/platform';
import { loadStatus } from '@/core/connectors/state';
import { connectors } from '@/core/connectors/registry';
import type { SettingsCategoryId } from '@/core/settings/registry/types';
import { useSyncStatus } from '@/core/sync/status';
import { useNewChangelog } from '@/core/changelog/useNewChangelog';
import { useUpdateStore } from '@/core/update/controller';
import { useChecklist } from '@/core/setup/checklist';
import { t } from '@/strings';
import { tSettingsV31 } from '@/strings.settingsV31';
import { tComfort } from '@/strings.comfort';
import styles from './SettingsLayout.module.css';

const s = t.settings.status;

function Sync() {
  const { phase } = useSyncStatus();
  return <>{phase === 'off' ? s.syncOff : s.syncOn}</>;
}

function Updates() {
  const available = useUpdateStore((u) => u.state.phase === 'available');
  return <>{available ? s.updates(1) : null}</>;
}

function NewChanges() {
  const fresh = useNewChangelog();
  return <>{fresh ? t.about.changes.fresh : null}</>;
}

function Ai() {
  const config = useAiConfig();
  const aiOn = useAiOn();
  if (!aiOn) return <>{t.ai.off.statusOff}</>;
  if (!config) return null;
  const n = config.providers.filter(isEntryUsable).length;
  return <>{n > 0 ? s.ai(n) : s.aiNone}</>;
}

function Connections() {
  const active = useLiveQuery(
    async () =>
      (await Promise.all(connectors.map((c) => loadStatus(c.id)))).filter(
        (x) => x.state === 'connected',
      ).length,
    [],
  );
  return <>{active ? s.connections(active) : null}</>;
}

function Modules() {
  const states = useModuleStates();
  const n = states ? Object.values(states).filter(Boolean).length : 0;
  return <>{n > 0 ? tComfort.get().status.modulesActive(n) : null}</>;
}

function Notifications() {
  const permission = getPlatform().notifications.permission();
  return <>{permission === 'granted' ? null : tComfort.get().status.notificationsOff}</>;
}

/** Setup progress ("4 von 12") while steps are open; nothing once all is done (calm, no badge to clear). */
function Setup() {
  const checklist = useChecklist();
  const o = tSettingsV31.use().setup;
  const list = checklist?.list;
  if (!list || list.total === 0 || list.open.length === 0) return null;
  return <>{o.navProgress(list.done, list.total)}</>;
}

/** Short state next to a category ("Verbunden", "1 verfügbar") where it helps; nothing for the rest. */
export function CategoryStatus({ id }: { id: SettingsCategoryId }) {
  const content =
    id === 'einrichtung' ? (
      <Setup />
    ) : id === 'sync' ? (
      <Sync />
    ) : id === 'updates' ? (
      <Updates />
    ) : id === 'ki' ? (
      <Ai />
    ) : id === 'verbindungen' ? (
      <Connections />
    ) : id === 'module' ? (
      <Modules />
    ) : id === 'benachrichtigungen' ? (
      <Notifications />
    ) : id === 'ueber' ? (
      <NewChanges />
    ) : null;
  return content ? <span className={styles.status}>{content}</span> : null;
}
