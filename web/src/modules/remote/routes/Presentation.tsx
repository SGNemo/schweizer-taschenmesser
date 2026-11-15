import { useState } from 'react';
import type { RemotePcState, RemoteKeyAction } from '@/core/platform/types';
import type { RemoteView } from '@/core/remote/session';
import { t } from '@/strings';
import { Icon } from '@/ui';
import { remoteSession } from '../session';
import { describePad } from '../view';
import styles from '../remote.module.css';
import { LevelState, useMouseLevel } from './level';

/**
 * Präsentation: the slides of the presentation in front at the PC, on the mouse-and-keyboard
 * level like Tastatur (same states and sentences). _Weiter_ big in the thumb zone with _Zurück_
 * beside it; above them one row _Start_ (F5) · _Schwarz_ (B) · _Ende_ (Esc). Only shown for a PC
 * that takes the presentation keys. The phone's volume keys keep their job (they never turn
 * slides).
 */
export function Presentation({
  view,
  last,
  tick,
  onMedia,
}: {
  view: RemoteView;
  last: RemotePcState | undefined;
  /** The short tick of a key (the page knows whether it is switched on). */
  tick: () => void;
  onMedia: () => void;
}) {
  const p = t.remote.presentation;
  const level = useMouseLevel(view);
  const line = describePad(view, level.pad, last);
  const usable = line.live || line.waiting;
  // a press that found the page not connected yet: it connects, and the page says so
  const [asked, setAsked] = useState(false);
  const [wasLive, setWasLive] = useState(line.live);
  if (wasLive !== line.live) {
    setWasLive(line.live);
    if (line.live) setAsked(false);
  }

  const press = (key: RemoteKeyAction) => {
    if (!line.live) {
      // not ready yet: the press is the person's step that connects or asks for the level –
      // nothing is sent later by itself, so the page says to press again
      level.touched();
      setAsked(true);
      return;
    }
    setAsked(false);
    tick();
    remoteSession.key(key);
  };
  const small = (action: RemoteKeyAction, face: string, label: string) => (
    <button
      type="button"
      className={styles.padKey}
      disabled={!usable}
      aria-label={label}
      onClick={() => press(action)}
      data-testid={`remote-${action}`}
    >
      {face}
    </button>
  );

  return (
    <div className={styles.slidesView}>
      <LevelState line={line} level={level} onMedia={onMedia} />
      <p className={styles.note} data-testid="remote-present-hint">
        {p.hint} {p.homeOnly}
      </p>
      {asked && !line.live && usable ? (
        <p role="status" className={styles.note} data-testid="remote-present-note">
          {t.remote.keys.connecting}
        </p>
      ) : null}

      <div className={styles.pad} role="group" aria-label={p.group} data-testid="remote-slides">
        <div className={styles.keyRow}>
          {small('key-f5', p.start, p.startLabel)}
          {small('key-b', p.black, p.blackLabel)}
          {small('key-escape', p.end, p.endLabel)}
        </div>
        <div className={styles.slideRow}>
          <button
            type="button"
            className={`${styles.key} ${styles.slideKey}`}
            disabled={!usable}
            onClick={() => press('key-left')}
            data-testid="remote-slide-previous"
          >
            <Icon name="chevronLeft" size={28} />
            <span>{p.previous}</span>
          </button>
          <button
            type="button"
            className={`${styles.key} ${styles.main} ${styles.slideKey}`}
            disabled={!usable}
            onClick={() => press('key-right')}
            data-testid="remote-slide-next"
          >
            <Icon name="chevronRight" size={28} />
            <span>{p.next}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
