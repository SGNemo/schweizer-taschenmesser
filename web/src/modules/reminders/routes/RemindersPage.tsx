import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { getPlatform } from '@/core/platform';
import { describeRecurrence } from '@/core/recurrence/describe';
import { useSettings } from '@/core/settings/settings';
import { formatDay, today } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { Badge, Button, Card, EmptyState, Icon, Switch } from '@/ui';
import { ReminderEditor, type EditorTarget } from '../components/ReminderEditor';
import { nextOccurrenceAt, reminderStatus, sortReminders } from '../logic';
import { reminderRepo } from '../repo';
import { settings } from '../settings';
import styles from './reminders.module.css';
import { StartDataButton } from '@/core/importer/StartDataButton';

export default function RemindersPage() {
  const reminders = useLiveQuery(
    async () => sortReminders(await reminderRepo.active().toArray(), now()),
    [],
  );
  const [prefs] = useSettings('module.reminders', settings.schema, settings.defaults);
  const [target, setTarget] = useState<EditorTarget>(null);
  const [params, setParams] = useSearchParams();
  const defaultTime = (prefs as { defaultTime?: string } | undefined)?.defaultTime ?? '09:00';
  const permission = getPlatform().notifications.permission();

  // `?new=1` (Quick-Add) opens the create dialog; derived from the URL, so no effect is needed.
  const draft: EditorTarget = {
    draft: { startDate: today(), time: /^\d{2}:\d{2}$/.test(defaultTime) ? defaultTime : '09:00' },
  };
  const openTarget = target ?? (params.get('new') && prefs ? draft : null);
  const closeEditor = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  return (
    <>
      <div className={styles.header}>
        <h1>{t.reminders.title}</h1>
        <Button variant="primary" onClick={() => setTarget(draft)}>
          <Icon name="plus" size={18} />
          {t.reminders.add}
        </Button>
      </div>

      {permission !== 'granted' && permission !== 'unsupported' ? (
        <div className={styles.banner} role="note">
          <span>{t.notifications.default}.</span>
          <Link to="/settings">{t.notifications.enable}</Link>
        </div>
      ) : null}

      {reminders && reminders.length === 0 ? (
        <EmptyState icon="bell" title={t.reminders.empty}>
          <StartDataButton moduleId="reminders" />
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
                      ? `${t.reminders.next}: ${formatDay(next.date, 'EEE, d. MMM yyyy')} · ${next.time}`
                      : null}
                    {status === 'ended' ? <Badge>{t.reminders.ended}</Badge> : null}
                    {status === 'paused' ? <Badge>{t.reminders.paused}</Badge> : null}
                  </span>
                </button>
                <Switch
                  label={`${r.title}: ${t.reminders.active}`}
                  checked={r.active}
                  onChange={(active) => void reminderRepo.update(r.id, { active })}
                />
              </div>
            </Card>
          );
        })}
      </ul>

      <ReminderEditor target={openTarget} onClose={closeEditor} />
    </>
  );
}
