import { useEffect, useRef } from 'react';
import type { RemoteButtonAction, RemotePcState } from '@/core/platform/types';
import type { RemoteView } from '@/core/remote/session';
import { holdKeepAwake } from '@/core/shell/keepAwake';
import { t } from '@/strings';
import { Button } from '@/ui';
import { PAD_IDLE, padStep, type Touch } from '../gestures';
import { remoteSession } from '../session';
import { describePad } from '../view';
import styles from '../remote.module.css';
import { LevelState, useMouseLevel } from './level';

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
  legendAsked,
  onLegendClose,
  onMedia,
}: {
  view: RemoteView;
  last: RemotePcState | undefined;
  /** The pointer's factor (the sensitivity setting). */
  speed: number;
  /** The short tick of a click (the page knows whether it is switched on). */
  tick: () => void;
  /** Show the one-time legend (once the pad can be used). */
  legend: boolean;
  /** The person asked for the legend from the menu: shown whatever the state. */
  legendAsked: boolean;
  onLegendClose: () => void;
  onMedia: () => void;
}) {
  const r = t.remote;
  const level = useMouseLevel(view);
  const line = describePad(view, level.pad, last);
  const gesture = useRef(PAD_IDLE);
  const { touched } = level;

  // the pad is a work surface: the screen stays on while it is open
  useEffect(() => holdKeepAwake(), []);

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
    touched();
    feed({ type: 'down', id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp });
  };

  return (
    <div className={styles.touch}>
      <LevelState line={line} level={level} onMedia={onMedia} className={styles.touchState} />

      {legendAsked || (legend && !line.step) ? (
        <section
          className={`${styles.legend} ${legendAsked ? '' : styles.touchLegend}`}
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
        className={`${styles.surface} ${line.live || line.waiting ? '' : styles.still}`}
        role="group"
        aria-label={r.pad.surface}
        aria-disabled={!line.live && !line.waiting}
        data-live={line.live}
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
        {(['left', 'right'] as const).map((button) => (
          <Strip
            key={button}
            button={button}
            label={button === 'left' ? r.pad.left : r.pad.right}
            disabled={!line.live && !line.waiting}
            waiting={line.waiting}
            onUse={touched}
            tick={tick}
          />
        ))}
      </div>
    </div>
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
  waiting,
  onUse,
  tick,
}: {
  button: 'left' | 'right';
  label: string;
  disabled: boolean;
  /** The pad is not live yet and a touch is the next step: a press does what a touch on the pad does and sends nothing. */
  waiting: boolean;
  onUse: () => void;
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
  // the strip goes inactive while it is held (the PC was locked mid-drag): let go at once – a
  // disabled button may never hear of the finger lifting
  useEffect(() => {
    if (disabled) release();
    // `release` reads refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);
  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || held.current) return;
    if (waiting) return onUse();
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
        if (waiting) return onUse();
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
