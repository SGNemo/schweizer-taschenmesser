import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useCenterStore } from '@/core/notifications/centerStore';
import {
  loadOpen,
  loadUpcoming,
  markAllDone,
  markDone,
  nextOpen,
  randomOpen,
  snoozeOpen,
} from '@/core/notifications/center';
import { refreshOpen } from '@/core/notifications/useOpenReminders';
import { snoozeOptions, type SnoozeOption } from '@/core/notifications/snooze';
import type { DueNotification } from '@/core/modules/types';
import { getPlatform } from '@/core/platform';
import { now } from '@/core/time/now';
import { relativeDayLabel } from '@/core/time/dates';
import { pad2, toDateString } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Dialog, EmptyState, Icon, IconButton, ItemList, ItemRow } from '@/ui';
import styles from './NotificationCenter.module.css';

/** "Heute · 14:30" – the day word and the local time of a reminder. */
export const whenLabel = (at: number): string => {
  const d = new Date(at);
  return `${relativeDayLabel(toDateString(d), toDateString(new Date(now())))} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/**
 * The notification centre: reminders are fetched on demand ("Nächste", "Zufällige") instead of
 * announcing themselves. A calm dialog: no blinking, no sound; focus returns to the opener on close.
 */
export function NotificationCenter() {
  const isOpen = useCenterStore((s) => s.isOpen);
  const mode = useCenterStore((s) => s.mode);
  const open = useCenterStore((s) => s.open);
  const close = useCenterStore((s) => s.closeCenter);
  const toast = useUiStore((s) => s.toast);
  const [focused, setFocused] = useState<DueNotification | undefined>();
  const [asRandom, setAsRandom] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [upcoming, setUpcoming] = useState<DueNotification | undefined>();
  // A choice made while an opening is still loading must survive the end of that load.
  const pickedWhileLoading = useRef(false);

  // Every opening reads the current state and shows what was asked for.
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    pickedWhileLoading.current = false;
    void (async () => {
      const list = await loadOpen();
      useCenterStore.getState().setOpenList(list);
      if (!alive) return;
      if (!pickedWhileLoading.current) {
        setChoosing(false);
        setAsRandom(mode === 'random');
        setFocused(
          mode === 'next' ? nextOpen(list) : mode === 'random' ? randomOpen(list) : undefined,
        );
      }
      setUpcoming(list.length === 0 ? await loadUpcoming() : undefined);
    })();
    return () => {
      alive = false;
    };
  }, [isOpen, mode]);

  const after = async (message: string) => {
    setChoosing(false);
    setFocused(undefined);
    const list = await refreshOpen();
    if (list.length === 0) setUpcoming(await loadUpcoming());
    toast(message);
  };
  const done = async (n: DueNotification) => {
    await markDone(n);
    await after(t.reminder.center.doneToast);
  };
  const later = async (n: DueNotification, option: SnoozeOption) => {
    await snoozeOpen(n, option);
    await after(t.reminder.snoozed[option]);
  };
  const pick = (random: boolean) => {
    pickedWhileLoading.current = true;
    setChoosing(false);
    setAsRandom(random);
    setFocused(random ? randomOpen(open, focused?.key) : nextOpen(open));
  };

  const options = snoozeOptions(now(), getPlatform().kind);
  return (
    <Dialog open={isOpen} onClose={close} title={t.reminder.center.title}>
      <div className={styles.modes}>
        <Button
          variant={focused && !asRandom ? 'primary' : 'secondary'}
          onClick={() => pick(false)}
        >
          {t.reminder.center.next}
        </Button>
        <Button variant={focused && asRandom ? 'primary' : 'secondary'} onClick={() => pick(true)}>
          {t.reminder.center.random}
        </Button>
      </div>

      {focused ? (
        <section className={styles.card} aria-label={t.reminder.label} data-testid="center-card">
          <span className={styles.label}>{whenLabel(focused.at)}</span>
          <span className={styles.title}>{focused.title}</span>
          {focused.body ? <span className={styles.body}>{focused.body}</span> : null}
          {choosing ? (
            <ul className={styles.options} aria-label={t.reminder.later}>
              {options.map((o) => (
                <li key={o}>
                  <button
                    type="button"
                    className={styles.option}
                    onClick={() => void later(focused, o)}
                  >
                    {t.reminder.laterOptions[o]}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.actions}>
              <Button variant="primary" data-autofocus onClick={() => void done(focused)}>
                {t.reminder.done}
              </Button>
              <Button onClick={() => setChoosing(true)}>{t.reminder.later}</Button>
              {focused.url ? (
                <Link to={focused.url} onClick={close}>
                  {t.reminder.open}
                </Link>
              ) : null}
              {asRandom && open.length > 1 ? (
                <Button variant="ghost" onClick={() => pick(true)}>
                  {t.reminder.center.another}
                </Button>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {open.length === 0 ? (
        <EmptyState compact title={t.reminder.center.none}>
          {upcoming ? (
            <p>{t.reminder.center.upcoming(`${upcoming.title} · ${whenLabel(upcoming.at)}`)}</p>
          ) : null}
        </EmptyState>
      ) : (
        <>
          <div className={styles.listHead}>
            <h3 className={styles.listTitle}>
              {t.reminder.center.list} · {open.length}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void markAllDone(open).then(() => after(t.reminder.center.allDoneToast))
              }
            >
              {t.reminder.center.allRead}
            </Button>
          </div>
          <ItemList label={t.reminder.center.list}>
            {open.map((n) => (
              <ItemRow
                key={n.key}
                title={n.title}
                meta={whenLabel(n.at)}
                onOpen={() => {
                  setChoosing(false);
                  setAsRandom(false);
                  setFocused(n);
                }}
                end={
                  <IconButton
                    label={t.reminder.center.doneAria(n.title)}
                    onClick={() => void done(n)}
                  >
                    <Icon name="check" />
                  </IconButton>
                }
              />
            ))}
          </ItemList>
        </>
      )}
    </Dialog>
  );
}
