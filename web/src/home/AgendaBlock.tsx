import { Link } from 'react-router';
import { useCalendarItems } from '@/core/modules/contributions';
import type { CalendarItem } from '@/core/modules/types';
import { formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { agendaRange, buildAgenda, LIMITS } from './agenda';
import styles from './AgendaBlock.module.css';

function Row({ item, withDay }: { item: CalendarItem; withDay?: boolean }) {
  const time = item.allDay || !item.time ? t.calendar.allDay : item.time;
  return (
    <li>
      <Link to={item.to ?? '/calendar'} className={styles.row}>
        <span className={styles.when}>
          {withDay ? `${formatDay(item.date, 'EEE')} ` : ''}
          {time}
        </span>
        <span className={styles.what}>{item.title}</span>
      </Link>
    </li>
  );
}

function Group({ title, items, testId }: { title: string; items: CalendarItem[]; testId: string }) {
  if (items.length === 0) return null;
  return (
    <div data-testid={testId}>
      <h3 className={styles.group}>{title}</h3>
      <ul className={styles.list}>
        {items.map((i) => (
          <Row key={`${i.source}:${i.id}:${i.date}`} item={i} />
        ))}
      </ul>
    </div>
  );
}

/**
 * "Heute · Morgen · diese Woche": the appointments, reminders and due dates of the next days at
 * a glance, in the calm and the detailed overview alike. Renders nothing before the data is
 * there; an empty week says so in one line and names the one next step.
 */
export function AgendaBlock() {
  const day = today();
  const items = useCalendarItems(agendaRange(day));
  const homeView = useUiStore((s) => s.homeView);
  if (!items) return null;
  const agenda = buildAgenda(items, day, LIMITS[homeView]);
  return (
    <section className={styles.block} aria-label={t.home.agenda.title} data-testid="agenda">
      <h2 className={styles.heading}>{t.home.agenda.title}</h2>
      {agenda.empty ? (
        <p className={styles.empty}>
          {t.home.agenda.empty} <Link to="/calendar?new=1">{t.home.agenda.emptyAction}</Link>
        </p>
      ) : (
        <>
          <Group title={t.home.agenda.today} items={agenda.today} testId="agenda-today" />
          <Group title={t.home.agenda.tomorrow} items={agenda.tomorrow} testId="agenda-tomorrow" />
          {agenda.week.length > 0 ? (
            <div data-testid="agenda-week">
              <h3 className={styles.group}>{t.home.agenda.week}</h3>
              <ul className={styles.list}>
                {agenda.week.flatMap((d) =>
                  d.items.map((i) => (
                    <Row key={`${i.source}:${i.id}:${i.date}`} item={i} withDay />
                  )),
                )}
              </ul>
            </div>
          ) : null}
          {agenda.hidden > 0 ? (
            <p className={styles.more}>
              <Link to="/calendar">{t.home.agenda.all}</Link>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
