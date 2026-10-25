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
import { deleteWithUndo, changeWithUndo } from '@/core/undo/withToast';
import { snoozeOptions } from '@/core/notifications/snooze';
import { snoozeTarget } from '@/core/time/quickShift';
import {
  Badge,
  Button,
  EmptyState,
  GroupedList,
  Icon,
  ItemList,
  ItemRow,
  type RowMenuItem,
} from '@/ui';
import type { Stored } from '@/core/db/types';
import type { CalendarEvent } from '../schema';
import { groupReminders } from '../reminderGroups';
import { isActive, isReminder, nextOccurrenceAt, reminderStatus } from '../reminders';
import { eventRepo } from '../repo';
import styles from '../routes/reminders.module.css';
import { settings } from '../settings';
import { EventEditor, type EventTarget } from './EventEditor';

/** Pause or resume the notification; the reminder stays in the list (undoable). */
function setEnabled(
  r: Stored<CalendarEvent>,
  enabled: boolean,
  message: string = enabled ? t.calendar.reminders.resumedToast : t.calendar.reminders.pausedToast,
) {
  return changeWithUndo(
    () =>
      eventRepo.update(r.id, { notify: { minutesBefore: r.notify?.minutesBefore ?? 0, enabled } }),
    message,
  );
}

/** The "⋯" entries of a reminder: Später (one-off), pause/resume, edit, delete; the first four are all undoable. */
export function reminderMenu(r: Stored<CalendarEvent>, onEdit: () => void): RowMenuItem[] {
  const items: RowMenuItem[] = [];
  if (!r.recurrence && isActive(r)) {
    for (const option of snoozeOptions(now(), getPlatform().kind)) {
      if (option === 'pc') continue;
      items.push({
        id: option,
        group: t.reminder.later,
        label: t.reminder.laterOptions[option],
        onSelect: () => {
          const to = snoozeTarget(option, now());
          void changeWithUndo(
            () =>
              eventRepo.update(r.id, {
                startDate: to.date,
                startTime: to.time,
                endDate: undefined,
                endTime: undefined,
              }),
            t.reminder.snoozed[option],
          );
        },
      });
    }
  }
  items.push({
    id: 'toggle',
    label: isActive(r) ? t.calendar.reminders.pause : t.calendar.reminders.resume,
    onSelect: () => void setEnabled(r, !isActive(r)),
  });
  items.push({ id: 'edit', label: t.actions.edit, onSelect: onEdit });
  items.push({
    id: 'delete',
    label: t.actions.delete,
    danger: true,
    onSelect: () => void deleteWithUndo(() => eventRepo.remove(r.id)),
  });
  return items;
}

/**
 * One reminder: a row with the title and the next time, the one main action "Erledigt" (a one-off
 * reminder that is still coming: switches its notification off, so it moves to "Erledigt"; undoable) and the "⋯" menu with everything else.
 * A repeat has no "Erledigt" (it would end the series); it is paused from the menu.
 */
export function ReminderRow({ r, onOpen }: { r: Stored<CalendarEvent>; onOpen: () => void }) {
  const status = reminderStatus(r, now());
  const next = nextOccurrenceAt(r, now());
  const recurrence = describeRecurrence(r.recurrence);
  return (
    <ItemRow
      title={r.title}
      done={status !== 'upcoming'}
      onOpen={onOpen}
      meta={
        <>
          {recurrence ? `${recurrence} · ` : null}
          {next
            ? `${t.calendar.reminders.next}: ${formatDay(next.date, 'EEE, d. MMM yyyy')} · ${next.time}`
            : null}
          {status === 'ended' ? <Badge>{t.calendar.reminders.ended}</Badge> : null}
          {status === 'paused' ? <Badge>{t.calendar.reminders.paused}</Badge> : null}
        </>
      }
      end={
        status === 'upcoming' && !r.recurrence ? (
          <Button
            size="sm"
            onClick={() => void setEnabled(r, false, t.calendar.reminders.markedDone)}
          >
            {t.calendar.reminders.markDone}
          </Button>
        ) : null
      }
      menu={reminderMenu(r, onOpen)}
    />
  );
}

/** The reminders of the calendar: events of the kind "reminder", pausable. */
export function RemindersTab({
  newRequested,
  onNewHandled,
}: {
  newRequested: boolean;
  onNewHandled: () => void;
}) {
  const reminders = useLiveQuery(
    async () => (await eventRepo.active().toArray()).filter(isReminder),
    [],
  );
  const groups = reminders ? groupReminders(reminders, now()) : [];
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
      {groups.length > 0 ? (
        <GroupedList
          listId="calendar-reminders"
          label={t.calendar.reminders.title}
          groups={groups.map((g) => ({
            id: g.id,
            label: t.groups[g.id],
            count: g.items.length,
            defaultClosed: g.id === 'done',
            children: (
              <ItemList>
                {g.items.map((r) => (
                  <ReminderRow key={r.id} r={r} onOpen={() => setTarget(r)} />
                ))}
              </ItemList>
            ),
          }))}
        />
      ) : null}

      <EventEditor target={openTarget} onClose={close} onDuplicated={setTarget} />
    </>
  );
}
