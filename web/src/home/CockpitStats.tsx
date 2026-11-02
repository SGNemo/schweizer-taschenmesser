import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { dateTimeFormat } from '@/core/i18n/format';
import {
  rankAttention,
  useAttentionItems,
  useCalendarItems,
  useHeadlines,
} from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import { Icon } from '@/ui';
import { useLiveAttention } from '@/core/modules/liveAttention';
import { now, pad2, today } from '@/core/time/now';
import { tCockpit } from '@/strings.cockpit';
import styles from './CockpitStats.module.css';
import { minutesUntil, nextAppointment } from './cockpitStats';

/** The clock and today's date, re-read every 20 seconds (the minute never lags by more than that). */
function useNow(): { time: string; date: string; hhmm: string } {
  const [ms, setMs] = useState(now);
  useEffect(() => {
    const id = window.setInterval(() => setMs(now()), 20_000);
    return () => window.clearInterval(id);
  }, []);
  const d = new Date(ms);
  return {
    time: dateTimeFormat({ hour: '2-digit', minute: '2-digit' }).format(d),
    date: dateTimeFormat({ weekday: 'long', day: 'numeric', month: 'long' }).format(d),
    hhmm: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

/**
 * "Großanzeige" of the cockpit: three large figures from core sources – the time, the next
 * appointment and how many things need attention. Each number carries a context line; no colour
 * (the "Jetzt wichtig" strip below already tells what is overdue).
 */
export function CockpitStats() {
  const tx = tCockpit.use();
  const { time, date, hhmm } = useNow();
  const day = today();
  const items = useCalendarItems({ from: day, to: day });
  const next = nextAppointment(items ?? [], hhmm);
  const attention = useAttentionItems();
  const live = useLiveAttention((s) => s.bySource);
  const open = rankAttention([...(attention ?? []), ...Object.values(live).flat()]).length;
  const headlines = useHeadlines() ?? [];
  return (
    <section className={styles.strip} aria-label={tx.stats} data-testid="cockpit-stats">
      <div className={styles.tile}>
        <span className={styles.label}>{tx.clock}</span>
        <time className={styles.value}>{time}</time>
        <span className={styles.context}>{date}</span>
      </div>
      <div className={styles.tile}>
        <span className={styles.label}>{tx.next}</span>
        {next ? (
          <>
            <Link to={next.to ?? '/calendar'} className={styles.value}>
              {next.time}
            </Link>
            <span className={styles.context}>
              {next.title} · {tx.nextIn(minutesUntil(next.time!, hhmm))}
            </span>
          </>
        ) : (
          <>
            <span className={styles.value}>–</span>
            <span className={styles.context}>{tx.nextNone}</span>
          </>
        )}
      </div>
      <div className={styles.tile}>
        <span className={styles.label}>{tx.attention}</span>
        <span className={styles.value}>{open}</span>
        <span className={styles.context}>
          {open === 0 ? tx.attentionNone : tx.attentionCount(open)}
        </span>
      </div>
      {headlines.map((h) => (
        <div
          key={h.moduleId}
          className={styles.tile}
          data-hue={h.hue}
          data-testid={`cockpit-headline-${h.moduleId}`}
        >
          <span className={styles.label}>
            <span className={styles.chip} aria-hidden="true">
              <Icon name={getManifest(h.moduleId)?.icon ?? 'puzzle'} size={14} />
            </span>
            {h.label}
          </span>
          <Link to={h.to ?? `/${h.moduleId}`} className={styles.value}>
            {h.value}
          </Link>
          {h.detail ? <span className={styles.context}>{h.detail}</span> : null}
        </div>
      ))}
    </section>
  );
}
