import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import type { RemoteButtonAction, RemotePcState } from '@/core/platform/types';
import type { RemoteView } from '@/core/remote/session';
import { useLang } from '@/core/i18n/lang';
import { settingsPath } from '@/core/settings/registry/paths';
import { holdKeepAwake } from '@/core/shell/keepAwake';
import { t } from '@/strings';
import { Button } from '@/ui';
import { PAD_IDLE, padStep, type Touch } from '../gestures';
import { remoteSession, useRemotePad } from '../session';
import { describePad } from '../view';
import styles from '../remote.module.css';

/** How often the pad asks for the mouse level by itself before it waits for a touch. */
const AUTO_TRIES = 2;

/**
 * Touchpad: the area is the pad, the two strips below it are the mouse buttons (holding "Links"
 * while sliding drags). The gestures are a pure function (`../gestures`); this only feeds it the
 * touches and hands on what comes out, at once and in order. The screen stays on. Nothing here
 * is stored or logged – a coordinate lives only inside the gesture it belongs to.
 *
 * Using the pad is what asks for the mouse level: Medien stays a media session. Whether this
 * phone may is decided at the PC; the phone's own unlock, if the PC wants one, is asked by the
 * native shell – a dismissed one is asked again only by the step "Entsperren".
 */
export function Touchpad({
  view,
  last,
  speed,
  tick,
  legend,
  onLegendClose,
  onMedia,
}: {
  view: RemoteView;
  last: RemotePcState | undefined;
  /** The pointer's factor (the sensitivity setting). */
  speed: number;
  /** The short tick of a click (the page knows whether it is switched on). */
  tick: () => void;
  /** Show the one-time legend. */
  legend: boolean;
  onLegendClose: () => void;
  onMedia: () => void;
}) {
  const r = t.remote;
  const lang = useLang();
  const pad = useRemotePad();
  const line = describePad(view, pad, last);
  const gesture = useRef(PAD_IDLE);
  const tries = useRef(0);

  // the pad is a work surface: the screen stays on while it is open
  useEffect(() => holdKeepAwake(), []);

  // Coming (back) to the pad is the person's step: a phone that was granted media only asks the
  // PC once more, the grant may have been given there meanwhile.
  useEffect(() => {
    if (remoteSession.pad().kind === 'not-granted') void remoteSession.raise(lang, { again: true });
    // only when the pad opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Being on the pad asks for the mouse level – a few times by itself at most, then a touch does.
  const connected = view.kind === 'connected';
  const pcLocked = view.kind === 'connected' && view.pc.locked;
  useEffect(() => {
    if (!connected) return;
    const wants = pad.kind === 'off' || (pad.kind === 'locked' && !pcLocked);
    if (!wants || tries.current >= AUTO_TRIES) return;
    tries.current += 1;
    void remoteSession.raise(lang);
  }, [connected, pad.kind, pcLocked, lang]);

  const feed = (touch: Touch) => {
    const [next, out] = padStep(gesture.current, touch, speed);
    gesture.current = next;
    for (const o of out) {
      if (o.kind === 'click') {
        tick();
        remoteSession.click(
          o.button === 'left' ? ['left-down', 'left-up'] : ['right-down', 'right-up'],
        );
      } else remoteSession.point(o.kind, o.dx, o.dy);
    }
  };
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    // every finger's touches arrive here, also when it slides off the pad
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (connected && pad.kind === 'off') {
      tries.current = 0;
      void remoteSession.raise(lang);
    }
    feed({ type: 'down', id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp });
  };

  return (
    <>
      <p className="sr-only" aria-live="polite" data-testid="remote-announce">
        {line.step ? line.text : ''}
      </p>
      <section className={styles.state} data-testid="remote-state">
        <p className={styles.stateLine}>{line.text}</p>
        {line.step === 'retry' ? (
          <div>
            <Button onClick={() => void remoteSession.open()} data-testid="remote-retry">
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
            <Button
              onClick={() => void remoteSession.raise(lang, { again: true })}
              data-testid="remote-unlock"
            >
              {r.pad.unlockStep}
            </Button>
          </div>
        ) : null}
        {line.step === 'pair' ? <Link to={settingsPath('sync', 'sync')}>{r.pair}</Link> : null}
        {line.step === 'disable' ? <Link to="/library/remote">{r.disable}</Link> : null}
      </section>

      {legend ? (
        <section
          className={styles.legend}
          aria-label={r.pad.legendTitle}
          data-testid="remote-legend"
        >
          <p className={styles.legendTitle}>{r.pad.legendTitle}</p>
          <ul className={styles.legendList}>
            {r.pad.legend.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div>
            <Button variant="ghost" onClick={onLegendClose} data-testid="remote-legend-close">
              {r.pad.legendClose}
            </Button>
          </div>
        </section>
      ) : null}

      <div
        className={`${styles.surface} ${line.live ? '' : styles.still}`}
        role="group"
        aria-label={r.pad.surface}
        aria-disabled={!line.live}
        data-testid="remote-surface"
        onPointerDown={down}
        onPointerMove={(e) =>
          feed({ type: 'move', id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp })
        }
        onPointerUp={(e) => feed({ type: 'up', id: e.pointerId, t: e.timeStamp })}
        onPointerCancel={(e) => feed({ type: 'cancel', id: e.pointerId })}
        onContextMenu={(e) => e.preventDefault()}
      />

      <div className={styles.strips} role="group" aria-label={r.pad.buttons}>
        <Strip button="left" label={r.pad.left} disabled={!line.live} tick={tick} />
        <Strip button="right" label={r.pad.right} disabled={!line.live} tick={tick} />
      </div>
    </>
  );
}

/**
 * One mouse button: down exactly as long as the strip is held (that is how dragging works).
 * Without a pointer – keyboard, screen reader – it clicks once.
 */
function Strip({
  button,
  label,
  disabled,
  tick,
}: {
  button: 'left' | 'right';
  label: string;
  disabled: boolean;
  tick: () => void;
}) {
  const held = useRef(false);
  const act = (way: 'down' | 'up') =>
    remoteSession.click([`${button}-${way}` as RemoteButtonAction]);
  const release = () => {
    if (!held.current) return;
    held.current = false;
    act('up');
  };
  // leaving the pad with the strip held lets go (the PC also releases at the session's end)
  useEffect(
    () => () => {
      if (held.current) remoteSession.click([`${button}-up` as RemoteButtonAction]);
    },
    [button],
  );
  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || held.current) return;
    // the release always arrives here, also when the thumb drifts off the strip
    e.currentTarget.setPointerCapture?.(e.pointerId);
    held.current = true;
    tick();
    act('down');
  };
  return (
    <button
      type="button"
      className={styles.strip}
      disabled={disabled}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      // the pointer already acted; a click without one (`detail` 0) is one whole click
      onClick={(e) => {
        if (e.detail > 0) return;
        tick();
        remoteSession.click([`${button}-down`, `${button}-up`] as RemoteButtonAction[]);
      }}
      onContextMenu={(e) => e.preventDefault()}
      data-testid={`remote-strip-${button}`}
    >
      {label}
    </button>
  );
}
