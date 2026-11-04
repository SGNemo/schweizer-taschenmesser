import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import { useCalendarItems } from '@/core/modules/contributions';
import { allManifests } from '@/core/modules/registry';
import type { CalendarItem } from '@/core/modules/types';
import { addDaysStr, formatDay, today } from '@/core/time/dates';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { agendaRange, buildAgenda, LIMITS } from './agenda';
import styles from './AgendaBlock.module.css';

const hueOf = (source: string) => allManifests.find((m) => m.id === source)?.identity.hue;

/** One entry on the time rail: time, a dot in the module's hue (or the outside calendar's colour), the title. */
function Row({ item, withDay }: { item: CalendarItem; withDay?: boolean }) {
  const time = item.allDay || !item.time ? t.calendar.allDay : item.time;
  return (
    <li data-hue={hueOf(item.source)}>
      <Link to={item.to ?? '/calendar'} className={styles.row} data-week={withDay ? '' : undefined}>
        <span className={styles.when}>
          {withDay ? `${formatDay(item.date, 'EEE')} ` : ''}
          {time}
        </span>
        <span
          className={styles.dot}
          aria-hidden="true"
          style={item.color ? ({ '--dot': item.color } as CSSProperties) : undefined}
        />
        <span className={styles.what}>{item.title}</span>
      </Link>
    </li>
  );
}

function Day({
  title,
  caption,
  accent,
  testId,
  children,
}: {
  title: string;
  caption: string;
  accent?: boolean;
  testId: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.day} data-testid={testId}>
      <h3 className={styles.group} data-accent={accent ? '' : undefined}>
        {title} <small className={styles.caption}>{caption}</small>
      </h3>
      <ul className={styles.list}>{children}</ul>
    </div>
  );
}

/**
 * "Heute · Morgen · diese Woche": the appointments, reminders and due dates of the next days at a glance, as up to three day
 * cards side by side (stacked on a narrow page), each with a time rail. Shown in the calm and the detailed overview alike.
 * Renders nothing before the data is there; days without entries are not shown, an empty week says so in one line and names
 * the one next step.
 */
export function AgendaBlock() {
  const day = today();
  const items = useCalendarItems(agendaRange(day));
  const homeView = useUiStore((s) => s.homeView);
  if (!items) return null;
  const agenda = buildAgenda(items, day, LIMITS[homeView]);
  const short = 'EEE, d. MMM';
  return (
    <section className={styles.block} aria-label={t.home.agenda.title} data-testid="agenda">
      <h2 className={styles.heading}>{t.home.agenda.title}</h2>
      {agenda.empty ? (
        <p className={styles.empty}>
          {t.home.agenda.empty} <Link to="/calendar?new=1">{t.home.agenda.emptyAction}</Link>
        </p>
      ) : (
        <>
          <div className={styles.days}>
            {agenda.today.length > 0 ? (
              <Day
                title={t.home.agenda.today}
                caption={formatDay(day, short)}
                accent
                testId="agenda-today"
              >
                {agenda.today.map((i) => (
                  <Row key={`${i.source}:${i.id}:${i.date}`} item={i} />
                ))}
              </Day>
            ) : null}
            {agenda.tomorrow.length > 0 ? (
              <Day
                title={t.home.agenda.tomorrow}
                caption={formatDay(addDaysStr(day, 1), short)}
                testId="agenda-tomorrow"
              >
                {agenda.tomorrow.map((i) => (
                  <Row key={`${i.source}:${i.id}:${i.date}`} item={i} />
                ))}
              </Day>
            ) : null}
            {agenda.week.length > 0 ? (
              <Day
                title={t.home.agenda.week}
                caption={`${formatDay(addDaysStr(day, 2), 'EEE')} – ${formatDay(addDaysStr(day, 6), 'EEE')}`}
                testId="agenda-week"
              >
                {agenda.week.flatMap((d) =>
                  d.items.map((i) => (
                    <Row key={`${i.source}:${i.id}:${i.date}`} item={i} withDay />
                  )),
                )}
              </Day>
            ) : null}
          </div>
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
