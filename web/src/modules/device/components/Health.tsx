import { useEffect, useState } from 'react';
import { formatTimestamp } from '@/core/i18n/format';
import { getPlatform } from '@/core/platform';
import type { SystemHealth } from '@/core/platform/system';
import { t } from '@/strings';
import { Icon } from '@/ui';
import { batteryWear } from '../system';
import styles from './Facts.module.css';

/**
 * "Zustand": how worn the battery is and when the PC last went down without shutting down (30 days). Read once per
 * visit, not polled. Calm by construction: a worn battery is said in words (warning tone only for "deutlich
 * abgenutzt", never red), a crash is a time and a stop code – no count that grows, no message text, no driver.
 */
export default function Health() {
  const h = t.device.health;
  const [health, setHealth] = useState<SystemHealth | null>(null);
  useEffect(() => {
    const read = getPlatform().system.health;
    if (!read) return;
    let alive = true;
    read().then(
      (v) => alive && setHealth(v),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);
  if (!health) return null;
  const wear = health.battery
    ? batteryWear(health.battery.designMwh, health.battery.fullMwh)
    : null;
  return (
    <section className={styles.section} aria-labelledby="device-health" data-testid="device-health">
      <h2 id="device-health" className={styles.head}>
        {h.title}
      </h2>
      <ul className={styles.tiles}>
        {wear && health.battery ? (
          <li className={styles.tile} data-testid="device-battery-health">
            <h3 className={styles.tileTitle}>{h.battery}</h3>
            <span
              className={`${styles.value} ${styles.state}`}
              data-tone={wear.state === 'weak' ? 'warning' : undefined}
            >
              {wear.state === 'weak' ? <Icon name="alert" size={18} /> : null}
              {h.state[wear.state]}
            </span>
            <p className={styles.sub}>
              {h.capacity(wear.percent)}
              {health.battery.cycles !== null ? ` · ${h.cycles(health.battery.cycles)}` : ''}
            </p>
            {wear.state === 'weak' ? <p className={styles.muted}>{h.weakContext}</p> : null}
          </li>
        ) : null}
        <li className={styles.tile} data-testid="device-crashes">
          <h3 className={styles.tileTitle}>{h.crashes}</h3>
          {!health.crashesRead ? (
            <p className={styles.sub}>{h.unreadable}</p>
          ) : health.crashes.length === 0 ? (
            <>
              <span className={`${styles.value} ${styles.state}`}>
                <Icon name="ok" size={18} />
                {h.crashesNone}
              </span>
              <p className={styles.sub}>{h.crashesWindow}</p>
            </>
          ) : (
            <>
              <p className={styles.sub}>{h.crashesWindow}</p>
              <ul className={styles.crashes}>
                {health.crashes.map((c) => (
                  <li key={`${c.atSecs}-${c.kind}`}>
                    <span className={styles.crashTime}>{formatTimestamp(c.atSecs * 1000)}</span>
                    <span>
                      {c.kind === 'bluescreen'
                        ? c.code
                          ? h.bluescreen(c.code)
                          : h.bluescreenNoCode
                        : h.unexpected}
                    </span>
                    {c.kind === 'unexpected' ? (
                      <span className={styles.muted}>{h.unexpectedContext}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {health.crashes.some((c) => c.code) ? (
                <p className={styles.muted}>{h.codeHint}</p>
              ) : null}
            </>
          )}
        </li>
      </ul>
    </section>
  );
}
