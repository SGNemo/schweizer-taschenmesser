import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Ring } from '@/ui';
import { androidVersion, formatPercent, type Fact } from '../system';
import { usePhoneBattery } from '../useLive';
import { PassportSection } from './Passport';
import styles from './Facts.module.css';

/**
 * The phone's part of Gerätestatus: its battery (level and charging, from the WebView) and a short passport
 * (Android version, Nemo version) to copy for support. Nothing is polled: the battery tells when it changes.
 */
export default function PhoneFacts() {
  const l = t.device.live;
  const p = t.device.passport;
  const battery = usePhoneBattery(true);
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getPlatform()
      .app.version()
      .then(
        (v) => alive && setVersion(v),
        () => undefined,
      );
    return () => {
      alive = false;
    };
  }, []);
  const android = androidVersion(navigator.userAgent);
  const facts: Fact[] = [
    ...(android ? [{ id: 'os', label: p.os, value: `${p.android} ${android}` }] : []),
    ...(version ? [{ id: 'app', label: p.app, value: version }] : []),
  ];
  return (
    <>
      {battery ? (
        <section className={styles.section} aria-labelledby="device-live" data-testid="device-live">
          <h2 id="device-live" className={styles.head}>
            {l.title}
          </h2>
          <ul className={styles.tiles}>
            <li className={styles.tile} data-testid="device-live-battery">
              <h3 className={styles.tileTitle}>{l.battery}</h3>
              <div className={styles.tileMain}>
                <Ring
                  percent={battery.percent}
                  level={battery.percent <= 10 ? 'full' : battery.percent <= 20 ? 'tight' : 'ok'}
                  size="sm"
                  label={l.battery}
                >
                  {/* The value stands next to the ring. */}
                  <span />
                </Ring>
                <div className={styles.tileText}>
                  <span className={styles.value}>{formatPercent(battery.percent)}</span>
                  <p className={styles.sub}>{battery.charging ? l.charging : l.onBattery}</p>
                </div>
              </div>
            </li>
          </ul>
        </section>
      ) : null}
      {facts.length > 0 ? <PassportSection facts={facts} /> : null}
    </>
  );
}
