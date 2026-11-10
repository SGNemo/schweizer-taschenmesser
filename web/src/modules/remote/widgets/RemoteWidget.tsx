import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { StatusWidget } from '@/ui';
import { useRemoteView } from '../session';
import { describe } from '../view';

/**
 * The remote control on the home screen: where it stands and one way in. Showing it opens no
 * connection – it only reads what the page's session last knew.
 */
export default function RemoteWidget() {
  const view = useRemoteView();
  const supported = getPlatform().remote.supported;
  const idle = view.kind === 'idle';
  return (
    <StatusWidget
      icon="monitor"
      state={
        !supported
          ? t.remote.phoneOnly
          : idle
            ? t.remote.widgetIdle
            : describe(view, undefined).text
      }
      hint={t.remote.widgetHint}
      action={supported ? { label: t.remote.open, to: '/remote' } : undefined}
    />
  );
}
