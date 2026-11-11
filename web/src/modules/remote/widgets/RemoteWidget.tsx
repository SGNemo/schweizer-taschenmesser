import { useEffect, useRef, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { settingsPath } from '@/core/settings/registry/paths';
import { useSyncStatus } from '@/core/sync/status';
import { t } from '@/strings';
import { StatusWidget } from '@/ui';
import { remoteSession, useLastPc, useRemoteView } from '../session';
import { describe, stepLink } from '../view';

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
  // the press of a tap did not go out (a slow connect drops it): once connected, say so
  const [missed, setMissed] = useState(false);
  // whether this widget opened the session (then it is this widget's to end; ending one the PC
  // already ended is harmless)
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
    // the tap did not go: the sentence (read out once), and the one step where it can be solved
    const action =
      line.step === 'pair' || line.step === 'disable'
        ? stepLink(line.step)
        : { to: '/remote', label: t.remote.open };
    return (
      <>
        <p className="sr-only" aria-live="polite">
          {line.text}
        </p>
        <StatusWidget icon="monitor" state={line.text} action={action} />
      </>
    );
  }

  const tap = () => {
    mine.current = true;
    setTapped(true);
    setMissed(false);
    // without a session the press opens one first and goes out once it stands; `false`: it did
    // not go out (the connect took too long and the press was let go, or the PC refused)
    void remoteSession.send('play-pause').then((sent) => setMissed(!sent));
  };
  // One still line. The PC's volume only while a session is open; after a tap, that the phone
  // is connecting; and if the connect outlived its press, that one more tap is needed.
  const state =
    view.kind === 'connected'
      ? missed
        ? t.remote.widgetMissed
        : line.text
      : tapped && view.kind === 'connecting'
        ? t.remote.widgetConnecting
        : t.remote.widgetIdle;
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {view.kind === 'connected' && missed ? t.remote.widgetMissed : ''}
      </p>
      <StatusWidget
        icon="monitor"
        state={state}
        hint={t.remote.widgetHint}
        action={{ label: t.remote.playPause, onClick: tap }}
      />
    </>
  );
}
