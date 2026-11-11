import { useEffect, useRef, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { settingsPath } from '@/core/settings/registry/paths';
import { useSyncStatus } from '@/core/sync/status';
import { t } from '@/strings';
import { StatusWidget } from '@/ui';
import { remoteSession, useLastPc, useRemoteView } from '../session';
import { describe } from '../view';

/**
 * The remote control on the home screen: one action, "Wiedergabe / Pause".
 *
 * Being shown opens nothing and claims nothing about the PC – only what the phone knows by
 * itself: whether a PC is paired at all. The tap is what connects: it goes through the app's one
 * session (`../session`), the same one the page uses, and the press goes out once it stands.
 * While that session is open the line names the PC's volume; a session this widget opened ends
 * when the home screen is left or the app goes to the background.
 *
 * A tap that cannot be carried out shows that state's sentence, and its one step leads into the
 * module (or to pairing), where every state has its way on.
 */
export default function RemoteWidget() {
  const supported = getPlatform().remote.supported;
  const paired = useSyncStatus((s) => s.via === 'lanClient');
  const view = useRemoteView();
  const last = useLastPc();
  // whether the person tapped here: only then a state of the session is this widget's to show
  const [tapped, setTapped] = useState(false);
  // whether this widget opened the session (then it is this widget's to end)
  const mine = useRef(false);

  useEffect(() => {
    const end = () => {
      if (!mine.current) return;
      mine.current = false;
      void remoteSession.close();
    };
    const onHide = () => {
      if (document.visibilityState !== 'visible') end();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      end();
    };
  }, []);

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

  const line = describe(view, last);
  if (tapped && line.step) {
    // the tap did not go: the sentence, and the one step where it can be solved
    const to =
      line.step === 'pair'
        ? settingsPath('sync', 'sync')
        : line.step === 'disable'
          ? '/library/remote'
          : '/remote';
    const label =
      line.step === 'pair'
        ? t.remote.pair
        : line.step === 'disable'
          ? t.remote.disable
          : t.remote.open;
    return <StatusWidget icon="monitor" state={line.text} action={{ label, to }} />;
  }

  const tap = () => {
    mine.current = true;
    setTapped(true);
    // without a session the press opens one first and goes out once it stands
    void remoteSession.send('play-pause');
  };
  return (
    <StatusWidget
      icon="monitor"
      // the PC's volume only while a session is open; else just whose remote this is
      state={view.kind === 'connected' ? line.text : t.remote.widgetIdle}
      hint={t.remote.widgetHint}
      action={{ label: t.remote.playPause, onClick: tap }}
    />
  );
}
