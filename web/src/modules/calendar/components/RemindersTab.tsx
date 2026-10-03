import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router';
import { StartDataButton } from '@/core/importer/StartDataButton';
import { getPlatform } from '@/core/platform';
import { describeRecurrence } from '@/core/recurrence/describe';
import { settingsPath } from '@/core/settings/registry/paths';
import { useSettings } from '@/core/settings/settings';
import { formatDay, today } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { Badge, Button, Card, EmptyState, Icon, Switch } from '@/ui';
import { isReminder, nextOccurrenceAt, reminderStatus, sortReminders } from '../reminders';
import { eventRepo } from '../repo';
import styles from '../routes/reminders.module.css';
import { settings } from '../settings';
import { EventEditor, type EventTarget } from './EventEditor';

/** The reminders of the calendar: events of the kind "reminder", pausable. */
export function RemindersTab({
  newRequested,
  onNewHandled,
}: {
  newRequested: boolean;
  onNewHandled: () => void;
}) {
  const reminders = useLiveQuery(
    async () => sortReminders((await eventRepo.active().toArray()).filter(isReminder), now()),
    [],
  );
  const [prefs] = useSettings('module.calendar', settings.schema, settings.defaults);
  const [target, setTarget] = useState<EventTarget>(null);
  const defaultTime = (prefs as { defaultReminderTime?: string } | undefined)?.defaultReminderTime;
  const permission = getPlatform().notifications.permission();

  const draft: EventTarget = {
    draft: {
      startDate: today(),
      kind: 'reminder',
      startTime: defaultTime && /^\d{2}:\d{2}$/.test(defaultTime) ? defaultTime : '09:00',
    },
  };
  const openTarget = target ?? (newRequested && prefs ? draft : null);
  const close = () => {
    setTarget(null);
    if (newRequested) onNewHandled();
  };

  return (
    <>
      <div className={styles.header}>
        <h2>{t.calendar.reminders.title}</h2>
        <Button variant="primary" onClick={() => setTarget(draft)}>
          <Icon name="plus" size={18} />
          {t.calendar.reminders.add}
        </Button>
      </div>

      {permission !== 'granted' && permission !== 'unsupported' ? (
        <div className={styles.banner} role="note">
          <span>{t.notifications.default}.</span>
          <Link to={settingsPath('benachrichtigungen', 'notifications')}>
            {t.notifications.enable}
          </Link>
        </div>
      ) : null}

      {reminders && reminders.length === 0 ? (
        <EmptyState title={t.calendar.reminders.empty}>
          <StartDataButton moduleId="calendar" />
        </EmptyState>
      ) : null}
      <ul className={styles.list}>
        {reminders?.map((r) => {
          const status = reminderStatus(r, now());
          const next = nextOccurrenceAt(r, now());
          return (
            <Card as="li" key={r.id} className={status === 'upcoming' ? '' : styles.inactive}>
              <div className={styles.row}>
                <button type="button" className={styles.main} onClick={() => setTarget(r)}>
                  <span className={styles.title}>{r.title}</span>
                  <span className={styles.muted}>{describeRecurrence(r.recurrence)}</span>
                  <span className={styles.muted}>
                    {next
                      ? `${t.calendar.reminders.next}: ${formatDay(next.date, 'EEE, d. MMM yyyy')} · ${next.time}`
                      : null}
                    {status === 'ended' ? <Badge>{t.calendar.reminders.ended}</Badge> : null}
                    {status === 'paused' ? <Badge>{t.calendar.reminders.paused}</Badge> : null}
                  </span>
                </button>
                <Switch
                  label={`${r.title}: ${t.calendar.reminders.active}`}
                  labelHidden
                  checked={status !== 'paused'}
                  onChange={(enabled) =>
                    void eventRepo.update(r.id, {
                      notify: { minutesBefore: r.notify?.minutesBefore ?? 0, enabled },
                    })
                  }
                />
              </div>
            </Card>
          );
        })}
      </ul>

      <EventEditor target={openTarget} onClose={close} />
    </>
  );
}
