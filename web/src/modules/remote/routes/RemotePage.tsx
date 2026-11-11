import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { getPlatform } from '@/core/platform';
import type { RemoteAction } from '@/core/platform/types';
import { createHoldGate, HOLD_STEPS_PER_SECOND } from '@/core/remote/session';
import { settingsPath } from '@/core/settings/registry/paths';
import { useSettings } from '@/core/settings/settings';
import { holdKeepAwake } from '@/core/shell/keepAwake';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { Button, EmptyState, Icon, PageHeader, RowMenu, type IconName } from '@/ui';
import { remoteSession, useLastPc, useRemoteView } from '../session';
import { DEFAULTS, settings, type RemotePrefs } from '../settings';
import { describe } from '../view';
import styles from '../remote.module.css';

const HOLD_MS = 1000 / HOLD_STEPS_PER_SECOND;

/**
 * Medien: volume in the lowest row, transport above it, the state as one line; "Ton aus" and "PC
 * sperren" in the menu. One-handed and without looking: big targets in the thumb zone, a short
 * tick on every press (switchable), nothing that moves. The session opens when the page comes to
 * the front and ends when it leaves. What this phone may do is decided at the PC.
 */
export default function RemotePage() {
  const supported = getPlatform().remote.supported;
  const view = useRemoteView();
  const [prefs] = useSettings('module.remote', settings.schema, settings.defaults);
  const { haptics, keepAwake } = { ...DEFAULTS, ...(prefs as RemotePrefs | undefined) };
  const [menu, setMenu] = useState(false);
  const r = t.remote;

  const last = useLastPc();

  // open while the page is in front, close when it leaves (another app, another page)
  useEffect(() => {
    if (!supported) return;
    const sync = () => {
      if (document.visibilityState === 'visible') void remoteSession.open();
      else void remoteSession.close();
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      void remoteSession.close();
    };
  }, [supported]);

  useEffect(() => {
    if (!supported || !keepAwake) return;
    // a hold that is given back: the cockpit may keep the screen on too
    return holdKeepAwake();
  }, [supported, keepAwake]);

  if (!supported) {
    return (
      <>
        <PageHeader title={r.meta.name} />
        <EmptyState title={r.phoneOnly} />
      </>
    );
  }

  const line = describe(view, last);
  const playing = (view.kind === 'connected' ? view.pc : last)?.playing ?? false;
  const tick = () => {
    if (haptics) navigator.vibrate?.(10);
  };
  const press = (action: RemoteAction, repeat = false) => {
    if (!repeat) tick();
    void remoteSession.send(action, { repeat });
  };
  const muted = (view.kind === 'connected' ? view.pc : last)?.mute ?? false;

  return (
    <div className={styles.page} data-testid="remote-page">
      <PageHeader title={r.meta.name}>
        <RowMenu
          label={r.more}
          open={menu}
          onOpenChange={setMenu}
          items={[
            { id: 'mute', label: muted ? r.unmute : r.mute, onSelect: () => press('mute') },
            { id: 'lock', label: r.lock, onSelect: () => press('lock') },
          ]}
        />
      </PageHeader>

      {/* Screen readers hear the sentences, never every volume step: one region that is always
          live and holds only a sentence to act on (empty while connected). */}
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
        {line.step === 'pair' ? <Link to={settingsPath('sync', 'sync')}>{r.pair}</Link> : null}
        {line.step === 'disable' ? <Link to="/library/remote">{r.disable}</Link> : null}
      </section>

      <div className={styles.pad} role="group" aria-label={r.media}>
        <div className={styles.row}>
          <Key
            icon="skipBack"
            label={r.previous}
            disabled={!line.usable}
            onPress={press}
            action="previous"
          />
          <Key
            icon={playing ? 'pause' : 'play'}
            label={playing ? r.pause : r.play}
            disabled={!line.usable}
            onPress={press}
            action="play-pause"
            main
          />
          <Key
            icon="skipForward"
            label={r.next}
            disabled={!line.usable}
            onPress={press}
            action="next"
          />
        </div>
        <div className={styles.row}>
          <Key
            icon="minus"
            label={r.quieter}
            disabled={!line.usable}
            onPress={press}
            action="volume-down"
            hold
          />
          <Key
            icon="plus"
            label={r.louder}
            disabled={!line.usable}
            onPress={press}
            action="volume-up"
            hold
          />
        </div>
      </div>
    </div>
  );
}

/**
 * One big button. `hold` (volume): the press acts at once – a tick and the first step when the
 * finger goes down – and keeping it pressed repeats the step, at most a few times a second. A
 * repeat never opens a connection; only the press itself does.
 */
function Key({
  icon,
  label,
  action,
  onPress,
  disabled,
  main,
  hold,
}: {
  icon: IconName;
  label: string;
  action: RemoteAction;
  onPress: (action: RemoteAction, repeat?: boolean) => void;
  disabled: boolean;
  main?: boolean;
  hold?: boolean;
}) {
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stop = () => {
    if (timer.current !== undefined) clearInterval(timer.current);
    timer.current = undefined;
  };
  useEffect(() => stop, []);
  // a key that goes inactive while held (the PC ended the session) stops repeating at once
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);
  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!hold || disabled) return;
    // the release always arrives here, also when the thumb drifts off the key
    e.currentTarget.setPointerCapture?.(e.pointerId);
    stop();
    onPress(action);
    const gate = createHoldGate(now);
    gate();
    timer.current = setInterval(() => {
      if (gate()) onPress(action, true);
    }, HOLD_MS);
  };
  // A hold key already acted when the pointer went down: the click a pointer leaves behind
  // (`detail` > 0) is ignored; one without a pointer (keyboard, screen reader) acts once.
  const click = (e: React.MouseEvent) => {
    if (hold && e.detail > 0) return;
    onPress(action);
  };
  return (
    <button
      type="button"
      className={`${styles.key} ${main ? styles.main : ''} ${hold ? styles.hold : ''}`}
      disabled={disabled}
      onClick={click}
      onPointerDown={down}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onContextMenu={hold ? (e) => e.preventDefault() : undefined}
      data-testid={`remote-${action}`}
    >
      <Icon name={icon} size={28} />
      <span>{label}</span>
    </button>
  );
}
