import { Fragment, memo, useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { GpuInfo, NetIface } from '@/core/platform/system';
import { t } from '@/strings';
import { Badge, Button, Card, Icon, patternStyles } from '@/ui';
import { formatUptime, percent } from '../format';
import { useSystemLive } from '../live';
import { formatCapacity } from '../logic/drives';
import {
  formatBoot,
  formatRate,
  gpuMemory,
  ramSummary,
  signalLabel,
  splitAdapters,
  totalRates,
} from '../logic/system';
import { LiveTile } from './LiveTile';
import { PublicIp } from './PublicIp';
import styles from './SystemTab.module.css';
import page from '@/pages/Page.module.css';

const REFRESH_MS = 3000;

/** Tab "System" of "Dieser PC": live facts about this computer. Read-only; nothing is stored. */
export default function SystemTab() {
  const [failed, setFailed] = useState(false);
  // Bumped by the button: the reading restarts at once.
  const [manual, setManual] = useState(0);
  const loaded = useSystemLive((s) => s.info !== null);

  useEffect(() => {
    const system = getPlatform().system;
    let alive = true;
    let busy = false;
    const load = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const [i, p, io] = await Promise.all([
          system.info(),
          system.processes(),
          system.diskIo().catch(() => []),
        ]);
        if (alive) {
          useSystemLive.getState().update(i, p, io);
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
      // The history belongs to this visit: leaving the tab drops it.
      useSystemLive.getState().clear();
    };
  }, [manual]);

  return (
    <>
      <p className={page.lead}>{t.system.lead}</p>
      <div className={patternStyles.gapBottom}>
        <Button variant="secondary" onClick={() => setManual((n) => n + 1)}>
          {t.system.refreshNow}
        </Button>
      </div>
      {failed ? <p role="alert">{t.system.failed}</p> : null}
      {!loaded && !failed ? <p aria-live="polite">{t.system.loading}</p> : null}
      {loaded ? (
        <div data-testid="system-info">
          <div className={styles.tiles}>
            <CpuTile />
            <RamTile />
            <NetTile />
            <BatteryTile />
          </div>
          <ThisPc />
          <Graphics />
          <Adapters />
        </div>
      ) : null}
      <Processes />
      <p className={page.lead}>{t.system.refresh}</p>
    </>
  );
}

// Each tile subscribes only to the values it shows, so a tick re-renders just the tiles whose
// numbers changed.

const CpuTile = memo(function CpuTile() {
  const usage = useSystemLive((s) => s.info?.cpu.usagePercent ?? 0);
  const brand = useSystemLive((s) => s.info?.cpu.brand ?? '');
  const cores = useSystemLive((s) => s.info?.cpu.physicalCores ?? null);
  const threads = useSystemLive((s) => s.info?.cpu.threads ?? 0);
  const mhz = useSystemLive((s) => s.info?.cpu.frequencyMhz ?? null);
  const series = useSystemLive((s) => s.cpu);
  return (
    <LiveTile
      testId="tile-cpu"
      title={t.system.cpu}
      percent={usage}
      level={usage >= 90 ? 'full' : 'ok'}
      value={t.system.load(Math.round(usage))}
      sub={
        <>
          {brand}
          <br />
          {t.system.cores(cores, threads)}
          {mhz ? ` · ${t.system.clock(mhz)}` : ''}
        </>
      }
      series={series}
      seriesLabel={t.system.sparkCpu}
    />
  );
});

const RamTile = memo(function RamTile() {
  const used = useSystemLive((s) => s.info?.memory.usedBytes ?? 0);
  const total = useSystemLive((s) => s.info?.memory.totalBytes ?? 0);
  const series = useSystemLive((s) => s.ram);
  const pct = percent(used, total);
  return (
    <LiveTile
      testId="tile-ram"
      title={t.system.memory}
      percent={pct}
      level={pct >= 90 ? 'full' : 'ok'}
      value={`${pct} %`}
      sub={t.system.memoryUsed(formatCapacity(used), formatCapacity(total), pct)}
      series={series}
      seriesLabel={t.system.sparkRam}
    />
  );
});

const NetTile = memo(function NetTile() {
  const network = useSystemLive((s) => s.info?.network);
  const series = useSystemLive((s) => s.down);
  const rates = network ? totalRates(network) : null;
  return (
    <LiveTile
      testId="tile-net"
      title={t.system.tileNetwork}
      value={rates ? `↓ ${formatRate(rates.down)}` : '–'}
      sub={rates ? `↑ ${formatRate(rates.up)}` : undefined}
      series={series}
      seriesLabel={t.system.sparkNet}
    />
  );
});

const BatteryTile = memo(function BatteryTile() {
  const battery = useSystemLive((s) => s.info?.battery ?? null);
  if (!battery) return null;
  const pct = battery.percent ?? 0;
  return (
    <LiveTile
      testId="tile-battery"
      title={t.system.batteryTile}
      percent={pct}
      value={battery.percent === null ? '–' : `${pct} %`}
      sub={t.system.batteryValue(battery.percent, battery.charging, battery.pluggedIn)}
    />
  );
});

function ThisPc() {
  const info = useSystemLive((s) => s.info);
  if (!info) return null;
  const up = formatUptime(info.uptimeSecs);
  const hw = info.hardware;
  const ram = ramSummary(hw.ram);
  const facts: [string, string][] = [
    [t.system.os, info.os],
    ...(hw.windowsBuild ? ([[t.system.windowsBuild, hw.windowsBuild]] as [string, string][]) : []),
    ...(hw.board ? ([[t.system.board, hw.board]] as [string, string][]) : []),
    ...(hw.bios ? ([[t.system.bios, hw.bios]] as [string, string][]) : []),
    ...(ram ? ([[t.system.ram, ram]] as [string, string][]) : []),
    [t.system.uptime, t.system.uptimeValue(up.days, up.hours, up.minutes)],
    [t.system.lastBoot, formatBoot(info.bootTimeSecs)],
    ...hw.displays.map((d, i): [string, string] => [
      i === 0 ? t.system.displays : '',
      t.system.display(d.width, d.height, d.refreshHz, d.primary),
    ]),
    ...(hw.audioOutput
      ? ([[t.system.audio, t.system.audioOut(hw.audioOutput)]] as [string, string][])
      : []),
    ...(hw.audioInput ? ([['', t.system.audioIn(hw.audioInput)]] as [string, string][]) : []),
    [t.system.cpuTemp, t.system.cpuTempGap],
  ];
  return (
    <section className={styles.section} aria-label={t.system.thisPc}>
      <h2>{t.system.thisPc}</h2>
      <Card>
        <dl className={styles.facts}>
          {facts.map(([k, v], i) => (
            <Fragment key={`${k}-${i}`}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </Fragment>
          ))}
        </dl>
      </Card>
    </section>
  );
}

function GpuItem({ g }: { g: GpuInfo }) {
  const mem = gpuMemory(g);
  return (
    <li>
      <div className={styles.row}>
        <strong>{g.name}</strong>
        {g.active ? <Badge tone="accent">{t.system.gpuActive}</Badge> : null}
      </div>
      <p className={styles.muted}>
        {mem.kind === 'own'
          ? t.system.gpuOwn(formatCapacity(mem.bytes))
          : mem.kind === 'shared'
            ? t.system.gpuShared(formatCapacity(mem.bytes))
            : null}
        {g.driverVersion
          ? `${mem.kind === 'none' ? '' : ' · '}${t.system.gpuDriver(g.driverVersion)}`
          : ''}
      </p>
    </li>
  );
}

function Graphics() {
  const gpus = useSystemLive((s) => s.info?.gpus);
  if (!gpus) return null;
  return (
    <section className={styles.section} aria-label={t.system.gpu}>
      <h2>{t.system.gpu}</h2>
      <Card>
        {gpus.length === 0 ? (
          <p>{t.system.noGpu}</p>
        ) : (
          <ul className={styles.gpus}>
            {gpus.map((g) => (
              <GpuItem key={g.name} g={g} />
            ))}
          </ul>
        )}
        <p className={styles.muted}>{t.system.gpuNote}</p>
      </Card>
    </section>
  );
}

function AdapterCard({ n, all }: { n: NetIface; all: boolean }) {
  const signal = signalLabel(n.signalPercent);
  return (
    <li>
      <Card className={styles.adapter} data-kind={n.kind}>
        <div className={styles.adapterHead}>
          <Icon name={n.kind === 'wifi' ? 'wifi' : 'network'} size={18} />
          <h3>{n.name}</h3>
          <Badge tone={n.up ? 'success' : 'neutral'}>
            {n.up ? t.system.connected : t.system.disconnected}
          </Badge>
          <Badge>{t.system.adapterKind[n.kind]}</Badge>
        </div>
        {n.kind === 'wifi' && n.ssid ? (
          <p>
            {t.system.ssid}: <strong>{n.ssid}</strong>
            {signal && n.signalPercent !== null
              ? ` · ${t.system.signal(t.system.signalWords[signal]!, n.signalPercent)}`
              : ''}
          </p>
        ) : null}
        {n.ipv4.length > 0 ? (
          <p>
            {t.system.ipv4}: <span className={styles.mono}>{n.ipv4.join(', ')}</span>
          </p>
        ) : null}
        {n.ipv6 ? (
          <p>
            {t.system.ipv6}: <span className={styles.mono}>{n.ipv6}</span>
          </p>
        ) : null}
        {all && n.ipv6Other.length > 0 ? (
          <p className={styles.muted}>
            <span className={styles.mono}>{n.ipv6Other.join(', ')}</span>
          </p>
        ) : null}
        {n.downBytesPerSec !== null ? (
          <p className={styles.muted}>
            ↓ {formatRate(n.downBytesPerSec)} · ↑ {formatRate(n.upBytesPerSec)}
          </p>
        ) : null}
      </Card>
    </li>
  );
}

function Adapters() {
  const network = useSystemLive((s) => s.info?.network);
  const [all, setAll] = useState(false);
  if (!network) return null;
  const { real, virtual } = splitAdapters(network);
  const hasMore = network.some((n) => n.ipv6Other.length > 0);
  return (
    <section className={styles.section} aria-label={t.system.adapters}>
      <h2>{t.system.adapters}</h2>
      {network.length === 0 ? <p>{t.system.noNetwork}</p> : null}
      <ul className={styles.adapters}>
        {[...real, ...virtual].map((n) => (
          <AdapterCard key={n.name} n={n} all={all} />
        ))}
      </ul>
      {virtual.length > 0 ? <p className={styles.muted}>{t.system.virtualNote}</p> : null}
      <div className={styles.row}>
        {hasMore ? (
          <Button variant="secondary" aria-pressed={all} onClick={() => setAll(!all)}>
            {all ? t.system.hideAll : t.system.showAll}
          </Button>
        ) : null}
      </div>
      <PublicIp />
    </section>
  );
}

function Processes() {
  const procs = useSystemLive((s) => s.procs);
  if (procs.length === 0) return null;
  return (
    <section className={styles.section} aria-label={t.system.processes}>
      <h2>{t.system.processes}</h2>
      <p className={page.lead}>{t.system.processesHint}</p>
      <div className={patternStyles.gapBottom}>
        <Button variant="secondary" onClick={() => void getPlatform().system.openTaskManager()}>
          {t.system.openTaskManager}
        </Button>
      </div>
      <table data-testid="system-processes" className={patternStyles.dataTable}>
        <thead>
          <tr>
            <th scope="col" className={patternStyles.alignStart}>
              {t.system.program}
            </th>
            <th scope="col" className={patternStyles.alignEnd}>
              {t.system.cpuColumn}
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
                {p.name} <span className={page.lead}>({t.system.instances(p.instances)})</span>
              </td>
              <td
                className={patternStyles.alignEnd}
              >{`${p.cpuPercent.toFixed(1).replace('.', ',')} %`}</td>
              <td className={patternStyles.alignEnd}>{formatCapacity(p.memoryBytes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
