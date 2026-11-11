import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useLang } from '@/core/i18n/lang';
import type { RemotePad, RemoteView } from '@/core/remote/session';
import { settingsPath } from '@/core/settings/registry/paths';
import { t } from '@/strings';
import { Button } from '@/ui';
import { remoteSession, useRemotePad } from '../session';
import type { PadLine } from '../view';
import styles from '../remote.module.css';

/** How often a view asks for the mouse-and-keyboard level by itself before it waits for a touch. */
const AUTO_TRIES = 2;

export interface MouseLevel {
  pad: RemotePad;
  /**
   * The person touched the view: without a session it connects first (the PC ends an idle session
   * by itself), then asks for the level – also when the PC was locked and is not now. After a
   * dismissed unlock it only connects: asking again is "Entsperren".
   */
  touched(): void;
  /** "Erneut versuchen": the person's step, so the view may ask by itself again. */
  retry(): void;
  /** "Entsperren": the person's step after a dismissed unlock. */
  unlock(): void;
}

/**
 * The mouse-and-keyboard level for a view that needs it (Touchpad, Tastatur). Being on such a
 * view is what asks for the level: Medien stays a media session. Whether this phone may is
 * decided at the PC; the phone's own unlock, if the PC wants one, is asked by the native shell –
 * a dismissed one is asked again only by the step "Entsperren", never by itself.
 */
export function useMouseLevel(view: RemoteView): MouseLevel {
  const lang = useLang();
  const pad = useRemotePad();
  const tries = useRef(0);

  // Coming (back) to the view is the person's step: a phone that was granted media only asks the
  // PC once more, the grant may have been given there meanwhile.
  // The same for a phone that could not ask for its screen lock: the PC may not want one any
  // more (no prompt comes of it – the shell answers at once).
  useEffect(() => {
    const kind = remoteSession.pad().kind;
    if (kind === 'not-granted' || kind === 'unavailable')
      void remoteSession.raise(lang, { again: true });
    // only when the view opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Being on the view asks for the level – a few times by itself at most, then a touch does
  // (only the person's own steps – a touch, "Erneut versuchen" – give it new tries: a try that
  // fails reconnects by itself and must not count as a fresh start).
  const connected = view.kind === 'connected';
  const pcLocked = view.kind === 'connected' && view.pc.locked;
  useEffect(() => {
    if (!connected) return;
    const wants = pad.kind === 'off' || (pad.kind === 'locked' && !pcLocked);
    if (!wants || tries.current >= AUTO_TRIES) return;
    tries.current += 1;
    void remoteSession.raise(lang);
  }, [connected, pad.kind, pcLocked, lang]);

  return {
    pad,
    touched() {
      const gone = view.kind === 'idle' || view.kind === 'disconnected';
      if (!gone && view.kind !== 'connected' && view.kind !== 'connecting') return;
      if (pad.kind === 'off' || (pad.kind === 'locked' && !pcLocked)) {
        tries.current = 0;
        void remoteSession.raise(lang);
      } else if (gone) void remoteSession.open();
    },
    retry() {
      tries.current = 0;
      void remoteSession.open();
    },
    unlock() {
      void remoteSession.raise(lang, { again: true });
    },
  };
}

/**
 * The state of a view that needs the level: one sentence and its one step. Screen readers hear
 * the sentence only when there is something to do.
 */
export function LevelState({
  line,
  level,
  onMedia,
  className,
}: {
  line: PadLine;
  level: MouseLevel;
  onMedia: () => void;
  className?: string;
}) {
  const r = t.remote;
  return (
    <>
      <p className="sr-only" aria-live="polite" data-testid="remote-announce">
        {line.step ? line.text : ''}
      </p>
      <section className={`${styles.state} ${className ?? ''}`} data-testid="remote-state">
        <p className={styles.stateLine}>{line.text}</p>
        {line.step === 'retry' ? (
          <div>
            <Button onClick={level.retry} data-testid="remote-retry">
              {r.retry}
            </Button>
          </div>
        ) : null}
        {line.step === 'media' ? (
          <div>
            <Button onClick={onMedia} data-testid="remote-to-media">
              {r.pad.toMedia}
            </Button>
          </div>
        ) : null}
        {line.step === 'unlock' ? (
          <div>
            <Button onClick={level.unlock} data-testid="remote-unlock">
              {r.pad.unlockStep}
            </Button>
          </div>
        ) : null}
        {line.step === 'pair' ? <Link to={settingsPath('sync', 'sync')}>{r.pair}</Link> : null}
        {line.step === 'disable' ? <Link to="/library/remote">{r.disable}</Link> : null}
      </section>
    </>
  );
}
