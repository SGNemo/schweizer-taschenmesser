import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { DriveInfo } from '@/core/platform/disk';
import type { SystemInfo } from '@/core/platform/system';
import { formatBytes } from '@/core/settings/storageInfo';
import { t } from '@/strings';
import { Button, Icon, Progress, Ring, Segmented, Sparkline, type IconName } from '@/ui';
import {
  connection,
  driveViews,
  formatPercent,
  formatRate,
  passport,
  percentOf,
  topPrograms,
  totalRates,
  uptimeParts,
  type DriveView,
} from '../system';
import { useLiveSystem, usePaused, type LiveState } from '../useLive';
import styles from './Facts.module.css';
import Health from './Health';
import { PassportSection } from './Passport';

const level = (pct: number) => (pct >= 90 ? 'full' : pct >= 75 ? 'tight' : 'ok');

function Tile({
  id,
  title,
  ring,
  value,
  sub,
  series,
  seriesLabel,
}: {
  id: string;
  title: string;
  /** The ring repeats no number: the value stands right next to it (the ring keeps its own label for screen readers). */
  ring?: { percent: number; label: string };
  value: string;
  sub?: string;
  series?: readonly number[];
  seriesLabel?: string;
}) {
  return (
    <li className={styles.tile} data-testid={`device-live-${id}`}>
      <h3 className={styles.tileTitle}>{title}</h3>
      <div className={styles.tileMain}>
        {ring ? (
          <Ring percent={ring.percent} level={level(ring.percent)} size="sm" label={ring.label}>
            <span />
          </Ring>
        ) : null}
        <div className={styles.tileText}>
          <span className={styles.value}>{value}</span>
          {sub ? <p className={styles.sub}>{sub}</p> : null}
        </div>
      </div>
      {series && series.length > 1 ? (
        <Sparkline values={series} label={seriesLabel} width={200} height={28} />
      ) : null}
    </li>
  );
}

function LiveTiles({ live }: { live: LiveState }) {
  const l = t.device.live;
  const info = live.info!;
  const cpu = Math.round(info.cpu.usagePercent);
  const ram = percentOf(info.memory.usedBytes, info.memory.totalBytes);
  const rates = totalRates(info.network);
  const link = connection(info.network);
  const up = uptimeParts(info.uptimeSecs);
  const battery = info.battery;
  const batteryState = battery
    ? battery.charging
      ? l.charging
      : battery.pluggedIn
        ? l.pluggedIn
        : l.onBattery
    : '';
  return (
    <ul className={styles.tiles} aria-label={l.title}>
      <Tile
        id="cpu"
        title={l.cpu}
        ring={{ percent: cpu, label: l.cpu }}
        value={formatPercent(cpu)}
        sub={l.cores(info.cpu.physicalCores, info.cpu.threads)}
        series={live.cpu}
        seriesLabel={l.spark.cpu}
      />
      <Tile
        id="memory"
        title={l.memory}
        ring={{ percent: ram, label: l.memory }}
        value={formatPercent(ram)}
        sub={l.memoryContext(
          formatBytes(info.memory.usedBytes),
          formatBytes(info.memory.totalBytes),
        )}
        series={live.ram}
        seriesLabel={l.spark.memory}
      />
      <Tile
        id="network"
        title={l.network}
        value={rates ? l.down(formatRate(rates.down)) : '–'}
        sub={rates ? l.up(formatRate(rates.up)) : l.noTraffic}
        series={live.down}
        seriesLabel={l.spark.network}
      />
      {battery ? (
        <Tile
          id="battery"
          title={l.battery}
          ring={
            battery.percent === null ? undefined : { percent: battery.percent, label: l.battery }
          }
          value={battery.percent === null ? '–' : formatPercent(battery.percent)}
          sub={batteryState}
        />
      ) : null}
      <Tile
        id="connection"
        title={l.connection}
        value={link ? (link.kind === 'wifi' ? l.wifi : l.cable) : l.offline}
        sub={
          !link
            ? l.offlineContext
            : link.kind === 'ethernet'
              ? l.cableContext
              : link.signal
                ? l.signal[link.signal]
                : l.noSignal
        }
      />
      <Tile
        id="uptime"
        title={l.uptime}
        value={l.uptimeValue(up.days, up.hours, up.minutes)}
        sub={l.uptimeContext}
      />
    </ul>
  );
}

function Programs({ live }: { live: LiveState }) {
  const p = t.device.programs;
  const [by, setBy] = useState<'cpu' | 'memory'>('cpu');
  const top = topPrograms(live.procs, by);
  return (
    <section
      className={styles.section}
      aria-labelledby="device-programs"
      data-testid="device-programs"
    >
      <div className={styles.head}>
        <h2 id="device-programs">{p.title}</h2>
        <Segmented
          label={p.title}
          value={by}
          options={[
            { value: 'cpu', label: p.byCpu },
            { value: 'memory', label: p.byMemory },
          ]}
          onChange={setBy}
        />
      </div>
      {top.length === 0 ? (
        <p className={styles.muted}>{p.empty}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{p.program}</th>
              <th scope="col" className={styles.num}>
                {by === 'cpu' ? t.device.live.cpu : t.device.live.memory}
              </th>
            </tr>
          </thead>
          <tbody>
            {top.map((proc) => (
              <tr key={proc.name}>
                <td>
                  {proc.name}
                  {p.instances(proc.instances) ? (
                    <span className={styles.count}>{p.instances(proc.instances)}</span>
                  ) : null}
                </td>
                <td className={styles.num}>
                  {by === 'cpu' ? formatPercent(proc.cpuPercent, 1) : formatBytes(proc.memoryBytes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className={styles.actions}>
        <p className={styles.muted}>{p.hint}</p>
        <Button
          variant="secondary"
          onClick={() =>
            void getPlatform()
              .system.openTaskManager()
              .catch(() => undefined)
          }
        >
          {p.taskManager}
        </Button>
      </div>
    </section>
  );
}

function DriveItem({ drive, n }: { drive: DriveView; n: number }) {
  const d = t.device.drives;
  const name = drive.system ? d.system : d.other(n);
  const media = d.media[drive.media];
  const state = d.health[drive.health];
  const icon: IconName =
    drive.health === 'warning' ? 'alert' : drive.health === 'ok' ? 'ok' : 'help';
  const detail =
    drive.health === 'warning'
      ? d.warningContext
      : drive.health === 'unknown' && drive.gap
        ? d[drive.gap]
        : null;
  return (
    <li className={styles.tile} data-testid="device-drive-item">
      <h3 className={styles.tileTitle}>{[name, media].filter(Boolean).join(' · ')}</h3>
      <Progress
        value={drive.usedPercent}
        max={100}
        label={d.free(formatBytes(drive.freeBytes), formatBytes(drive.totalBytes))}
        tone={drive.usedPercent >= 95 ? 'danger' : drive.usedPercent >= 85 ? 'warning' : undefined}
      />
      <p className={styles.sub}>
        <span
          className={styles.state}
          data-tone={drive.health === 'warning' ? 'warning' : undefined}
        >
          <Icon name={icon} size={16} />
          {state}
        </span>
        {drive.temperatureC !== null ? ` · ${d.temperature(drive.temperatureC)}` : ''}
      </p>
      {detail ? <p className={styles.muted}>{detail}</p> : null}
    </li>
  );
}

function Drives() {
  const [drives, setDrives] = useState<DriveView[] | null>(null);
  useEffect(() => {
    const disk = getPlatform().disk;
    if (!disk.supported) return;
    let alive = true;
    disk.listDrives().then(
      (list: DriveInfo[]) => alive && setDrives(driveViews(list)),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);
  if (!drives || drives.length === 0) return null;
  let other = 1; // The system drive is the first; the others count on from 2.
  return (
    <section className={styles.section} aria-labelledby="device-drives" data-testid="device-drives">
      <h2 id="device-drives" className={styles.head}>
        {t.device.drives.title}
      </h2>
      <ul className={styles.tiles}>
        {drives.map((drive, i) => (
          <DriveItem key={i} drive={drive} n={drive.system ? 0 : ++other} />
        ))}
      </ul>
    </section>
  );
}

export const passportLabels = () => ({ ...t.device.passport, cores: t.device.live.cores });

function Passport({ info }: { info: SystemInfo }) {
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
  return <PassportSection facts={passport(info, version, passportLabels())} />;
}

/**
 * The desktop's live part of Gerätestatus: load tiles, the busiest programs, the drives and the hardware passport.
 * It reads only while the page is open and visible, and only shows: ending a program is the Task Manager's job.
 */
export default function DesktopFacts() {
  const l = t.device.live;
  const [paused, setPaused] = usePaused();
  const supported = getPlatform().system.supported;
  const live = useLiveSystem(supported, paused);
  return (
    <>
      {supported ? (
        <section className={styles.section} aria-labelledby="device-live" data-testid="device-live">
          <div className={styles.head}>
            <h2 id="device-live">{l.title}</h2>
            <Button
              variant="secondary"
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
              data-testid="device-live-pause"
            >
              <Icon name={paused ? 'play' : 'pause'} size={16} />
              {paused ? l.resume : l.pause}
            </Button>
          </div>
          {live.info ? <LiveTiles live={live} /> : null}
          {!live.info && !live.failed && !paused ? (
            <p className={styles.muted} aria-live="polite">
              {l.loading}
            </p>
          ) : null}
          {live.failed ? <p role="alert">{l.failed}</p> : null}
          <p className={styles.muted}>{paused ? l.paused : l.note}</p>
        </section>
      ) : null}
      {live.info ? <Programs live={live} /> : null}
      {supported ? <Health /> : null}
      <Drives />
      {live.info ? <Passport info={live.info} /> : null}
    </>
  );
}
