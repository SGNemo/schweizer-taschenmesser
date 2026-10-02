import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { ProcInfo, SystemInfo } from '@/core/platform/system';
import { t } from '@/strings';
import { Button, Card, patternStyles, Progress } from '@/ui';
import { formatBytes, formatUptime, percent } from '../format';
import styles from '@/pages/Page.module.css';

const REFRESH_MS = 3000;

/** Usage bar; from 90 % on it turns to the warning colour of `Progress`. */
function Meter({ label, value }: { label: string; value: number }) {
  return <Progress label={label} value={value} max={100} over={value >= 90} />;
}

/** Tab "System" of "Dieser PC": live facts about this computer, read-only. */
export default function SystemTab() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [procs, setProcs] = useState<ProcInfo[]>([]);
  const [failed, setFailed] = useState(false);
  // Bumped by the button: the reading restarts at once.
  const [manual, setManual] = useState(0);

  useEffect(() => {
    const system = getPlatform().system;
    let alive = true;
    let busy = false;
    const load = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const [i, p] = await Promise.all([system.info(), system.processes()]);
        if (alive) {
          setInfo(i);
          setProcs(p);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      } finally {
        busy = false;
      }
    };
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [manual]);

  const up = info ? formatUptime(info.uptimeSecs) : null;
  const memPct = info ? percent(info.memory.usedBytes, info.memory.totalBytes) : 0;

  return (
    <>
      <p className={styles.lead}>{t.system.lead}</p>
      <div className={patternStyles.gapBottom}>
        <Button onClick={() => setManual((n) => n + 1)}>{t.system.refreshNow}</Button>
      </div>
      {failed ? <p role="alert">{t.system.failed}</p> : null}
      {!info && !failed ? <p aria-live="polite">{t.system.loading}</p> : null}
      {info && up ? (
        <div className={styles.grid} data-testid="system-info">
          <Card title={t.system.system}>
            <dl className={patternStyles.flush}>
              <dt>{t.system.os}</dt>
              <dd>{info.os}</dd>
              <dt>{t.system.uptime}</dt>
              <dd>{t.system.uptimeValue(up.days, up.hours, up.minutes)}</dd>
            </dl>
          </Card>
          <Card title={t.system.cpu}>
            <p className={patternStyles.flush}>{info.cpu.brand}</p>
            <p className={styles.lead}>
              {t.system.cores(info.cpu.physicalCores, info.cpu.threads)}
            </p>
            <Meter label={t.system.cpu} value={info.cpu.usagePercent} />
            <p className={patternStyles.flush}>
              {t.system.load(Math.round(info.cpu.usagePercent))}
            </p>
          </Card>
          <Card title={t.system.memory}>
            <Meter label={t.system.memory} value={memPct} />
            <p className={patternStyles.flush}>
              {t.system.memoryUsed(
                formatBytes(info.memory.usedBytes),
                formatBytes(info.memory.totalBytes),
                memPct,
              )}
            </p>
          </Card>
          <Card title={t.system.battery}>
            <p className={patternStyles.flush}>
              {info.battery
                ? t.system.batteryValue(
                    info.battery.percent,
                    info.battery.charging,
                    info.battery.pluggedIn,
                  )
                : t.system.noBattery}
            </p>
            {info.battery?.percent !== null && info.battery ? (
              <Meter label={t.system.battery} value={info.battery.percent ?? 0} />
            ) : null}
          </Card>
          <Card title={t.system.gpu}>
            {info.gpus.length === 0 ? (
              <p className={patternStyles.flush}>{t.system.noGpu}</p>
            ) : (
              <ul className={styles.list}>
                {info.gpus.map((g) => (
                  <li key={g.name}>{t.system.gpuValue(g.name, formatBytes(g.dedicatedBytes))}</li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t.system.network}>
            {info.network.length === 0 ? (
              <p className={patternStyles.flush}>{t.system.noNetwork}</p>
            ) : (
              <ul className={styles.list}>
                {info.network.map((n) => (
                  <li key={n.name}>
                    <strong>{n.name}</strong>: {n.addresses.join(', ')}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
      {procs.length > 0 ? (
        <section className={styles.section} aria-label={t.system.processes}>
          <h2>{t.system.processes}</h2>
          <p className={styles.lead}>{t.system.processesHint}</p>
          <table data-testid="system-processes" className={patternStyles.dataTable}>
            <thead>
              <tr>
                <th scope="col" className={patternStyles.alignStart}>
                  {t.system.program}
                </th>
                <th scope="col" className={patternStyles.alignEnd}>
                  {t.system.memory}
                </th>
              </tr>
            </thead>
            <tbody>
              {procs.map((p) => (
                <tr key={p.name}>
                  <td>
                    {p.name}{' '}
                    <span className={styles.lead}>({t.system.instances(p.instances)})</span>
                  </td>
                  <td className={patternStyles.alignEnd}>{formatBytes(p.memoryBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      <p className={styles.lead}>{t.system.refresh}</p>
    </>
  );
}
