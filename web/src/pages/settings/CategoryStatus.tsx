import { useAiOn } from '@/core/ai/switch';
import { useLiveQuery } from 'dexie-react-hooks';
import { isEntryUsable, useAiConfig } from '@/core/ai/config';
import { loadStatus } from '@/core/connectors/state';
import { connectors } from '@/core/connectors/registry';
import type { SettingsCategoryId } from '@/core/settings/registry/types';
import { useSyncStatus } from '@/core/sync/status';
import { useUpdateStore } from '@/core/update/controller';
import { t } from '@/strings';
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

/** Short state next to a category ("Verbunden", "1 verfügbar") where it helps; nothing for the rest. */
export function CategoryStatus({ id }: { id: SettingsCategoryId }) {
  const content =
    id === 'sync' ? (
      <Sync />
    ) : id === 'updates' ? (
      <Updates />
    ) : id === 'ki' ? (
      <Ai />
    ) : id === 'verbindungen' ? (
      <Connections />
    ) : null;
  return content ? <span className={styles.status}>{content}</span> : null;
}
