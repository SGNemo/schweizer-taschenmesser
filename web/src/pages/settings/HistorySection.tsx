import { formatTimestamp } from '@/core/i18n/format';
import {
  clearHistory,
  isHistoryOn,
  setHistoryOn,
  undoEntry,
  useHistory,
} from '@/core/settings/history';
import { useUiStore } from '@/stores/ui';
import { tSettings3 } from '@/strings.settings3';
import { Button, SettingRow, SettingsGroup, Switch } from '@/ui';
import settingsStyles from './settings.module.css';
import styles from './HistorySection.module.css';

/** Settings → Allgemein → Verwalten → "Änderungsverlauf": the last 30 changes on this device, each can be taken back. */
export function HistorySection() {
  const h = tSettings3.use().history;
  const entries = useHistory();
  const toast = useUiStore((s) => s.toast);
  return (
    <SettingsGroup id="settings-history" title={h.title} description={h.description}>
      <SettingRow id="settings-history--on" label={h.on}>
        <Switch label={h.on} labelHidden checked={isHistoryOn()} onChange={setHistoryOn} />
      </SettingRow>
      {entries.length === 0 ? (
        <p className={settingsStyles.muted}>{h.empty}</p>
      ) : (
        <ul className={styles.list} data-testid="history-list">
          {entries.map((e) => (
            <li key={e.id} className={styles.item}>
              <span className={styles.text}>
                {e.label}
                <span className={settingsStyles.muted}>{formatTimestamp(e.at)}</span>
              </span>
              <Button
                variant="ghost"
                onClick={() => void undoEntry(e.id).then(() => toast(h.undone))}
                data-testid="history-undo"
              >
                {h.undo}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {entries.length > 0 ? (
        <div>
          <Button
            variant="ghost"
            onClick={() => {
              clearHistory();
              toast(h.cleared);
            }}
          >
            {h.clear}
          </Button>
        </div>
      ) : null}
    </SettingsGroup>
  );
}
