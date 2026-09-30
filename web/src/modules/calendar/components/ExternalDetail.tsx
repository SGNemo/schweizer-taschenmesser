import { useLiveQuery } from 'dexie-react-hooks';
import { mapsUrl } from '@/core/links';
import { getPlatform } from '@/core/platform';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { Badge, Button, Dialog, Icon } from '@/ui';
import { externalRepo } from '../repo';
import styles from '../routes/calendar.module.css';

const safeUrl = (url: string | undefined) => (url && /^https?:\/\//i.test(url) ? url : undefined);

/** Read-only view of an event that a connector copied into the calendar. */
export function ExternalDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const event = useLiveQuery(() => (id ? externalRepo.get(id) : undefined), [id]);
  const link = safeUrl(event?.url);
  const when = event
    ? [
        formatDay(event.startDate, 'EEEE, d. MMMM yyyy'),
        event.endDate && event.endDate !== event.startDate
          ? `– ${formatDay(event.endDate, 'EEEE, d. MMMM yyyy')}`
          : '',
        !event.allDay && event.startTime
          ? `${event.startTime}${event.endTime ? `–${event.endTime}` : ''}`
          : t.calendar.allDay,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  return (
    <Dialog open={id !== null} onClose={onClose} title={event?.title ?? t.calendar.external.title}>
      {event ? (
        <div className={styles.detail}>
          <p>
            <Badge>
              {t.calendar.external.from(t.calendar.external.sources[event.source] ?? event.source)}
            </Badge>
          </p>
          <p>{when}</p>
          {event.location ? (
            <p>
              <strong>{t.calendar.location}:</strong> {event.location}{' '}
              <Button
                variant="ghost"
                onClick={() => void getPlatform().app.openUrl(mapsUrl(event.location!))}
              >
                <Icon name="pin" size={16} />
                {t.calendar.showOnMap}
              </Button>
            </p>
          ) : null}
          {event.note ? <p className={styles.detailNote}>{event.note}</p> : null}
          <p className={styles.muted}>{t.calendar.external.readOnly}</p>
          <div className={styles.detailActions}>
            {link ? (
              <Button onClick={() => void getPlatform().app.openUrl(link)}>
                {t.calendar.external.open}
              </Button>
            ) : (
              <span />
            )}
            <Button variant="primary" onClick={onClose} data-autofocus>
              {t.actions.close}
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
