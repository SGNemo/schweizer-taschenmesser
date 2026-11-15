import { useState } from 'react';
import { Link } from 'react-router';
import { useModuleStates } from '@/core/modules/activation';
import { getPlatform } from '@/core/platform';
import { settingsPath } from '@/core/settings/registry/paths';
import { formatDay } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { saveCapture } from '@/quickCapture/targets';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, DayField, Dialog, TextField, TimeField } from '@/ui';
import { nextFullHour, remindAt } from '../logic';
import type { StoredPlace } from '../repo';
import { formatZoneTime } from '../view';
import styles from '../clock.module.css';

/**
 * "Erinnern um …": a time on the place's wall clock becomes one calendar reminder at the matching local time. No alarm
 * engine of its own: the reminder goes through the quick-capture target `reminder` (no module import), so quiet
 * hours, Stumm, Zock-Modus and repeats are the calendar's. Once only: a series in the place's zone would need a field
 * on the calendar entry (decision 2026-11-15). Keyed by the place, so it starts fresh.
 */
export function RemindDialog({
  place,
  hereZone,
  onClose,
}: {
  place: StoredPlace | null;
  hereZone: string;
  onClose: () => void;
}) {
  const [start] = useState(() => nextFullHour(now(), place?.zone ?? hereZone));
  const [text, setText] = useState('');
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [busy, setBusy] = useState(false);
  const calendarOn = useModuleStates()?.calendar;
  const permission = getPlatform().notifications.permission();

  const target = place ? remindAt(date, time, place.zone, hereZone) : undefined;
  const past = !!target && target.at <= now();
  const value = text.trim();
  const ready = !!place && !!target && !past && !!value && calendarOn === true && !busy;
  const hereLine = target
    ? t.clock.remind.here(
        formatDay(target.date, 'EEE, d. MMM'),
        formatZoneTime(target.at, hereZone),
      )
    : t.clock.remind.invalid;

  const save = async () => {
    if (!ready || !place || !target) return;
    setBusy(true);
    try {
      const saved = await saveCapture('reminder', {
        title: t.clock.remind.entry(value, formatZoneTime(target.at, place.zone), place.label),
        date: target.date,
        time: target.time,
      });
      const { toast } = useUiStore.getState();
      toast(
        t.clock.remind.saved(
          formatDay(target.date, 'EEE, d. MMM'),
          formatZoneTime(target.at, hereZone),
        ),
        {
          label: t.ui.undo,
          run: () => {
            void saved.undo().then(() => toast(t.ui.undone));
          },
        },
      );
      onClose();
    } catch {
      useUiStore.getState().toast(t.clock.remind.invalid);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!place}
      onClose={onClose}
      title={place ? t.clock.remind.title(place.label) : ''}
      askAfterTyping
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.actions.cancel}
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!ready}>
            {t.clock.remind.save}
          </Button>
        </>
      }
    >
      {place ? (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {calendarOn === false ? (
            <p className={styles.banner} role="note" data-testid="clock-remind-off">
              <span>{t.clock.remind.calendarOff}</span>
              <Link to="/library">{t.nav.library}</Link>
            </p>
          ) : null}
          <TextField
            label={t.clock.remind.text}
            placeholder={t.clock.remind.textPlaceholder}
            value={text}
            maxLength={120}
            onChange={(e) => setText(e.target.value)}
            data-autofocus
            data-testid="clock-remind-text"
          />
          <div className={styles.split}>
            <DayField
              label={t.clock.remind.date(place.label)}
              value={date}
              onChange={setDate}
              hint=""
              required
            />
            <TimeField label={t.clock.remind.time(place.label)} value={time} onChange={setTime} />
          </div>
          {/* The figure the person checks before saving: when it rings here, live with every change. */}
          <p className={styles.preview} aria-live="polite" data-testid="clock-remind-here">
            {past ? t.clock.remind.past : hereLine}
          </p>
          <p className={styles.note}>{t.clock.remind.once}</p>
          {/* The same calm line as the calendar's reminders tab when notifications are not allowed yet. */}
          {permission !== 'granted' && permission !== 'unsupported' ? (
            <p className={styles.banner} role="note">
              <span>{t.notifications.default}.</span>
              <Link to={settingsPath('benachrichtigungen', 'notifications')}>
                {t.notifications.enable}
              </Link>
            </p>
          ) : null}
        </form>
      ) : null}
    </Dialog>
  );
}
