import { CHANNELS, channelOn, withChannel, type Channel } from '@/core/notifications/channels';
import { useModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { useFocusSettings } from '@/core/settings/focus';
import { tSettings4 } from '@/strings.settings4';
import { SettingsGroup, Switch } from '@/ui';
import settingsStyles from './settings.module.css';
import styles from './NotificationSourcesSection.module.css';

/**
 * Settings → Benachrichtigungen → "Meldungen pro Modul": for every active module that notifies, two
 * switches: the bell list in the app and the notice at the due time (system or card). Only ever a
 * switch-off; a module that is on everywhere leaves no trace in the settings.
 */
export function NotificationSourcesSection() {
  const n = tSettings4.use().notifySources;
  const [focus, patch] = useFocusSettings();
  const states = useModuleStates();
  const modules = availableManifests().filter(
    (m) => states?.[m.id] && m.contributions?.notifications,
  );
  const label = (c: Channel) => (c === 'center' ? n.colCenter : n.colAlert);
  return (
    <SettingsGroup id="notification-sources" title={n.title} description={n.description}>
      <p className={settingsStyles.muted}>{n.note}</p>
      {modules.length === 0 ? (
        <p className={settingsStyles.muted}>{n.empty}</p>
      ) : (
        <table className={styles.table} data-testid="notify-sources">
          <thead>
            <tr>
              <th scope="col">{n.colModule}</th>
              {CHANNELS.map((c) => (
                <th key={c} scope="col">
                  {label(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => {
              const allOff = CHANNELS.every((c) => !channelOn(focus.notifyChannels, m.id, c));
              return (
                <tr key={m.id} data-testid={`notify-row-${m.id}`}>
                  <th scope="row">
                    {m.name}
                    {allOff ? <span className={styles.off}>{n.bothOff}</span> : null}
                  </th>
                  {CHANNELS.map((c) => (
                    <td key={c}>
                      <Switch
                        label={n.switchLabel(m.name, label(c))}
                        labelHidden
                        checked={channelOn(focus.notifyChannels, m.id, c)}
                        onChange={(on) =>
                          void patch({
                            notifyChannels: withChannel(focus.notifyChannels, m.id, c, on),
                          })
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </SettingsGroup>
  );
}
