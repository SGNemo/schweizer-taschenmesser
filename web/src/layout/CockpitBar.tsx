import { useEffect, useRef, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { dateTimeFormat } from '@/core/i18n/format';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { tCockpit } from '@/strings.cockpit';
import { useUiStore } from '@/stores/ui';
import { Button, Icon, IconButton } from '@/ui';
import { NotificationBell } from './NotificationBell';
import { exitCockpit, toggleCockpitFullscreen } from './useCockpit';
import styles from './CockpitBar.module.css';

/** How close to the top edge (px) the pointer has to come for the bar to slide in. */
export const EDGE_PX = 8;
/** How long the bar stays after the pointer left it (ms). */
export const LINGER_MS = 1200;

/** `HH:mm` in the user's locale, re-read every half minute. */
function useClock(): string {
  const [text, setText] = useState(() => format(now()));
  useEffect(() => {
    const id = window.setInterval(() => setText(format(now())), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return text;
}
const format = (ms: number): string =>
  dateTimeFormat({ hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

/**
 * The floating mini bar of the cockpit: hidden until the pointer touches the top edge, the grip is
 * tapped or focus moves into it (Tab). Search, "+ Neu", reminders, tools, the clock, full screen and
 * "Cockpit beenden" – the same actions as the top bar, nothing new to learn.
 */
export function CockpitBar() {
  const [open, setOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const grip = useRef<HTMLButtonElement>(null);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setQuickAddOpen = useUiStore((s) => s.setQuickAddOpen);
  const openTools = useUiStore((s) => s.openTools);
  const editing = useUiStore((s) => s.homeEditing);
  const setEditing = useUiStore((s) => s.setHomeEditing);
  const clock = useClock();
  const tx = tCockpit.use();
  const fullscreen = getPlatform().display.fullscreenSupported;

  const clearTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
  };
  const hideLater = () => {
    clearTimer();
    timer.current = window.setTimeout(() => setOpen(false), LINGER_MS);
  };

  // Pointer at the top edge (mouse / pen only): the bar slides in and lingers a moment after leaving.
  useEffect(() => {
    if (!window.matchMedia?.('(hover: hover)').matches) return; // touch screens use the grip
    const onMove = (e: PointerEvent) => {
      if (e.clientY <= EDGE_PX) {
        clearTimer();
        setOpen(true);
      }
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      clearTimer();
    };
  }, []);

  const shown = open || pinnedOpen;
  return (
    <div
      className={styles.host}
      data-open={shown ? 'true' : undefined}
      data-testid="cockpit-bar"
      onPointerLeave={() => {
        if (!pinnedOpen) hideLater();
      }}
      onPointerEnter={clearTimer}
      onFocus={(e) => {
        // Focus inside the bar opens it (Tab); focusing the grip itself does not – its click decides.
        if ((e.target as Node) === grip.current) return;
        clearTimer();
        setOpen(true);
      }}
      onBlur={(e) => {
        if (!pinnedOpen && !e.currentTarget.contains(e.relatedTarget as Node | null)) hideLater();
      }}
    >
      <button
        ref={grip}
        type="button"
        className={styles.grip}
        aria-label={shown ? tx.hideBar : tx.showBar}
        aria-expanded={shown}
        aria-controls="cockpit-bar"
        onClick={() => {
          clearTimer();
          setPinnedOpen(!shown);
          setOpen(!shown);
        }}
      >
        <span className={styles.gripLine} aria-hidden="true" />
      </button>
      <div id="cockpit-bar" className={styles.bar} role="toolbar" aria-label={tx.bar}>
        <button type="button" className={styles.search} onClick={() => setPaletteOpen(true)}>
          <Icon name="search" size={18} />
          <span className={styles.label}>{t.actions.search}</span>
        </button>
        <Button
          variant="primary"
          aria-label={t.nav.createAria}
          onClick={() => setQuickAddOpen(true)}
        >
          <Icon name="plus" size={18} />
          <span className={styles.label}>{t.nav.create}</span>
        </Button>
        <NotificationBell />
        <IconButton label={t.tools.open} onClick={() => openTools()}>
          <Icon name="wrench" />
        </IconButton>
        <IconButton
          label={editing ? t.homeEdit.done : tx.customize}
          aria-pressed={editing}
          onClick={() => setEditing(!editing)}
        >
          <Icon name={editing ? 'check' : 'edit'} />
        </IconButton>
        <time className={styles.clock} aria-label={tx.clock}>
          {clock}
        </time>
        {fullscreen ? (
          <IconButton label={tx.fullscreen} onClick={() => void toggleCockpitFullscreen()}>
            <Icon name="maximize" />
          </IconButton>
        ) : null}
        <Button variant="secondary" onClick={exitCockpit} data-testid="cockpit-exit">
          <Icon name="minimize" size={18} />
          <span className={styles.label}>{tx.exit}</span>
        </Button>
      </div>
    </div>
  );
}
