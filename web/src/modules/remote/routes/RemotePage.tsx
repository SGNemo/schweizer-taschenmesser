import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { getPlatform } from '@/core/platform';
import type { RemoteAction } from '@/core/platform/types';
import { createHoldGate, HOLD_STEPS_PER_SECOND } from '@/core/remote/session';
import { useSettings } from '@/core/settings/settings';
import { holdKeepAwake } from '@/core/shell/keepAwake';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { Button, EmptyState, Icon, PageHeader, RowMenu, Tabs, type IconName } from '@/ui';
import {
  remoteSession,
  useLastPc,
  useRemotePower,
  useRemotePresent,
  useRemoteView,
} from '../session';
import { DEFAULTS, PAD_SPEED, settings, type RemotePrefs } from '../settings';
import { describe, stepLink, type RemoteLine } from '../view';
import { useVolumeKeys } from '../volumeKeys';
import styles from '../remote.module.css';
import { Keyboard } from './Keyboard';
import { PowerSheet, PowerStatus } from './Power';
import { Presentation } from './Presentation';
import { Touchpad } from './Touchpad';

const HOLD_MS = 1000 / HOLD_STEPS_PER_SECOND;

type RemoteTab = 'media' | 'touchpad' | 'keyboard' | 'present';

/**
 * Three views: Medien (default), Touchpad (`./Touchpad`) and Tastatur (`./Keyboard`); a fourth,
 * Präsentation (`./Presentation`), on a PC that takes the presentation keys.
 *
 * Medien: volume in the lowest row, transport above it, the state as one line; "Ton aus" and "PC
 * sperren" in the menu, and – on a PC that knows them – "Monitor aus" and "PC ausschalten …" (the
 * sheet `./Power`; its state is one line above the views). One-handed and without looking: big targets in the thumb zone, a short
 * tick on every press (switchable), nothing that moves. The session opens when the page comes to
 * the front and ends when it leaves. What this phone may do is decided at the PC.
 */
export default function RemotePage() {
  const supported = getPlatform().remote.supported;
  const live = useRemoteView();
  const power = useRemotePower();
  const present = useRemotePresent();
  const [powerSheet, setPowerSheet] = useState(false);
  const [prefs, setPrefs] = useSettings('module.remote', settings.schema, settings.defaults);
  const { haptics, keepAwake, volumeKeys, padSpeed, padLegendSeen } = {
    ...DEFAULTS,
    ...(prefs as RemotePrefs | undefined),
  };
  const [menu, setMenu] = useState(false);
  const [chosen, setTab] = useState<RemoteTab>('media');
  // Präsentation exists only while the PC said it takes those keys
  const tab: RemoteTab = chosen === 'present' && !present ? 'media' : chosen;
  // a PC without presentation sends the page back to Medien for good: a later answer with the
  // feature must not switch the tab by itself
  useEffect(() => {
    if (chosen === 'present' && !present) setTab('media');
  }, [chosen, present]);
  /** The legend was asked for again from the menu (the stored "seen" stays). */
  const [legendAgain, setLegendAgain] = useState(false);
  const r = t.remote;

  const last = useLastPc();
  // (not before the stored answer is read: a switched-off setting must not take the keys first)
  const keysWithPc = useVolumeKeys(supported && prefs !== undefined && volumeKeys);

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

  // After "done" the PC goes away on purpose: its disconnect (and that it cannot be reached
  // afterwards) is shown as the quiet last state, the power line says what happens.
  const view =
    power.phase.kind === 'done' && live.kind !== 'connected'
      ? ({ kind: 'disconnected' } as const)
      : live;
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
            ...(power.info
              ? [{ id: 'monitor-off', label: r.monitorOff, onSelect: () => press('monitor-off') }]
              : []),
            ...(power.info?.granted
              ? [{ id: 'power', label: r.power.open, onSelect: () => setPowerSheet(true) }]
              : []),
            ...(tab === 'touchpad'
              ? [{ id: 'legend', label: r.pad.legendTitle, onSelect: () => setLegendAgain(true) }]
              : []),
          ]}
        />
      </PageHeader>
      <Tabs<RemoteTab>
        label={r.views}
        value={tab}
        options={[
          { value: 'media', label: r.media },
          { value: 'touchpad', label: r.touchpad },
          { value: 'keyboard', label: r.keyboard },
          ...(present ? [{ value: 'present' as const, label: r.presentation.tab }] : []),
        ]}
        onChange={(next) => {
          setTab(next);
          setLegendAgain(false);
        }}
      />

      <PowerStatus />
      <PowerSheet
        open={powerSheet}
        onClose={() => setPowerSheet(false)}
        hibernate={power.info?.hibernate === true}
      />

      {keysWithPc ? (
        <p className={styles.note} data-testid="remote-volume-keys">
          {r.volumeKeysNote}
        </p>
      ) : null}

      {tab === 'touchpad' ? (
        <Touchpad
          view={view}
          last={last}
          speed={PAD_SPEED[padSpeed]}
          tick={tick}
          // (not before the stored answer is read: a closed legend must not flash up)
          legend={prefs !== undefined && !padLegendSeen}
          legendAsked={legendAgain}
          onLegendClose={() => {
            setLegendAgain(false);
            if (!padLegendSeen) void setPrefs({ padLegendSeen: true });
          }}
          onMedia={() => setTab('media')}
        />
      ) : tab === 'keyboard' ? (
        <Keyboard view={view} last={last} tick={tick} onMedia={() => setTab('media')} />
      ) : tab === 'present' ? (
        <Presentation view={view} last={last} tick={tick} onMedia={() => setTab('media')} />
      ) : (
        <Media line={line} playing={playing} press={press} />
      )}
    </div>
  );
}

/** The view Medien: the state line and the keys. */
function Media({
  line,
  playing,
  press,
}: {
  line: RemoteLine;
  playing: boolean;
  press: (action: RemoteAction, repeat?: boolean) => void;
}) {
  const r = t.remote;
  return (
    <>
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
        {line.step === 'pair' || line.step === 'disable' ? (
          <Link to={stepLink(line.step).to}>{stepLink(line.step).label}</Link>
        ) : null}
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
    </>
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
