import { getPlatform } from '@/core/platform';
import { settingsPath } from '@/core/settings/registry/paths';
import { useSyncStatus } from '@/core/sync/status';
import { t } from '@/strings';
import { StatusWidget } from '@/ui';

/**
 * The remote control on the home screen: one way in. It opens no connection, so it claims
 * nothing about the PC – only what the phone knows by itself: whether a PC is paired at all.
 */
export default function RemoteWidget() {
  const supported = getPlatform().remote.supported;
  const paired = useSyncStatus((s) => s.via === 'lanClient');
  if (!supported) return <StatusWidget icon="monitor" state={t.remote.phoneOnly} />;
  if (!paired) {
    return (
      <StatusWidget
        icon="monitor"
        state={t.remote.state.notPaired}
        action={{ label: t.remote.pair, to: settingsPath('sync', 'sync') }}
      />
    );
  }
  return (
    <StatusWidget
      icon="monitor"
      state={t.remote.widgetIdle}
      hint={t.remote.widgetHint}
      action={{ label: t.remote.open, to: '/remote' }}
    />
  );
}
