/**
 * Pure helpers for the live part of Gerätestatus: history of the live tiles, the top programs, the connection in
 * words, the drives and the hardware passport. Everything here is read from `getPlatform().system` / `.disk` while
 * the page is open and lives in memory only. What the page never shows comes in here and stops here: IP addresses,
 * network names, adapter names, drive letters, labels and models, audio device names (they can carry a person's name).
 */
import { formatNumber } from '@/core/i18n/format';
import type { DriveInfo } from '@/core/platform/disk';
import type { NetIface, ProcInfo, RamModule, SystemInfo } from '@/core/platform/system';
import { formatBytes } from '@/core/settings/storageInfo';

/** Two minutes at one reading every three seconds. */
export const LIVE_POINTS = 40;
export const LIVE_MS = 3000;

export const pushPoint = (list: readonly number[], v: number, max = LIVE_POINTS): number[] =>
  Number.isFinite(v) ? [...list, v].slice(-max) : [...list];

export const percentOf = (used: number, total: number): number =>
  total > 0 ? Math.min(100, Math.max(0, Math.round((used / total) * 100))) : 0;

const KB = 1024;
const MB = KB ** 2;

/** "812 KB/s", "1,5 MB/s". */
export function formatRate(bytesPerSec: number | null | undefined): string {
  if (bytesPerSec == null || !Number.isFinite(bytesPerSec) || bytesPerSec < 0) return '–';
  if (bytesPerSec >= MB)
    return `${formatNumber(bytesPerSec / MB, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB/s`;
  if (bytesPerSec >= KB) return `${formatNumber(Math.round(bytesPerSec / KB))} KB/s`;
  return `${Math.round(bytesPerSec)} B/s`;
}

const realUp = (network: readonly NetIface[]) =>
  network.filter((n) => (n.kind === 'wifi' || n.kind === 'ethernet') && n.up);

/** Sum over the connected real adapters (virtual ones would count the same traffic twice); `null` = not reported. */
export function totalRates(network: readonly NetIface[]): { down: number; up: number } | null {
  const real = realUp(network);
  if (real.length === 0 || real.every((n) => n.downBytesPerSec == null)) return null;
  return {
    down: real.reduce((s, n) => s + (n.downBytesPerSec ?? 0), 0),
    up: real.reduce((s, n) => s + (n.upBytesPerSec ?? 0), 0),
  };
}

export type Signal = 'strong' | 'ok' | 'weak';
export const signalWord = (percent: number | null): Signal | null =>
  percent == null ? null : percent >= 67 ? 'strong' : percent >= 34 ? 'ok' : 'weak';

/** How this device is connected, in words only: cable before Wi-Fi; never a name or an address. */
export function connection(
  network: readonly NetIface[],
): { kind: 'ethernet' | 'wifi'; signal: Signal | null } | null {
  const real = realUp(network);
  const cable = real.find((n) => n.kind === 'ethernet');
  if (cable) return { kind: 'ethernet', signal: null };
  const wifi = real.find((n) => n.kind === 'wifi');
  return wifi ? { kind: 'wifi', signal: signalWord(wifi.signalPercent) } : null;
}

/** The `n` programs that use the most CPU or memory (programs with no share at all stay out). */
export function topPrograms(procs: readonly ProcInfo[], by: 'cpu' | 'memory', n = 5): ProcInfo[] {
  const key = (p: ProcInfo) => (by === 'cpu' ? p.cpuPercent : p.memoryBytes);
  return [...procs]
    .filter((p) => key(p) > 0)
    .sort((a, b) => key(b) - key(a) || a.name.localeCompare(b.name))
    .slice(0, n);
}

export function uptimeParts(secs: number): { days: number; hours: number; minutes: number } {
  const s = Math.max(0, Math.floor(secs));
  return {
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
  };
}

/** "2 × 8 GB DDR5 · 6000 MHz"; equal modules are grouped. */
export function ramSummary(modules: readonly RamModule[]): string | null {
  if (modules.length === 0) return null;
  const groups = new Map<string, { m: RamModule; n: number }>();
  for (const m of modules) {
    const key = `${m.sizeBytes}|${m.kind}|${m.speedMhz}`;
    const g = groups.get(key);
    if (g) g.n++;
    else groups.set(key, { m, n: 1 });
  }
  return [...groups.values()]
    .map(({ m, n }) =>
      [
        `${n} × ${formatBytes(m.sizeBytes)}${m.kind ? ` ${m.kind}` : ''}`,
        m.speedMhz ? `${m.speedMhz} MHz` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    )
    .join(', ');
}

/** A drive as the page speaks about it: no letter, label or model. Fixed drives only, the system drive first. */
export interface DriveView {
  system: boolean;
  media: DriveInfo['media'];
  bus: DriveInfo['bus'];
  totalBytes: number;
  freeBytes: number;
  usedPercent: number;
  health: DriveInfo['health']['status'];
  /** Why the health is not known (Windows wants admin rights, or the drive cannot tell). */
  gap: DriveInfo['health']['gap'];
  temperatureC: number | null;
}

export function driveViews(drives: readonly DriveInfo[]): DriveView[] {
  return drives
    .filter((d) => d.kind === 'fixed' && d.totalBytes > 0)
    .sort((a, b) => Number(b.isSystem) - Number(a.isSystem))
    .map((d) => ({
      system: d.isSystem,
      media: d.media,
      bus: d.bus,
      totalBytes: d.totalBytes,
      freeBytes: d.freeBytes,
      usedPercent: percentOf(d.totalBytes - d.freeBytes, d.totalBytes),
      health: d.health.status,
      gap: d.health.gap,
      temperatureC: d.health.temperatureC,
    }));
}

/** One fact of the hardware passport: a label and its value (missing facts are left out, never "unbekannt"). */
export interface Fact {
  id: string;
  label: string;
  value: string;
}

export interface PassportLabels {
  os: string;
  build: string;
  cpu: string;
  cores: (cores: number | null, threads: number) => string;
  gpu: string;
  gpuMemory: (size: string) => string;
  ram: string;
  board: string;
  bios: string;
  display: string;
  displayValue: (w: number, h: number, hz: number) => string;
  app: string;
}

/**
 * The facts a support person asks for. Never an address, a network or adapter name, a path, a user name, a serial
 * number or an audio device name: only what the hardware and Windows are, not whose they are.
 */
export function passport(info: SystemInfo, appVersion: string | null, l: PassportLabels): Fact[] {
  const hw = info.hardware;
  const facts: (Fact | null)[] = [
    { id: 'os', label: l.os, value: info.os },
    hw.windowsBuild ? { id: 'build', label: l.build, value: hw.windowsBuild } : null,
    info.cpu.brand
      ? {
          id: 'cpu',
          label: l.cpu,
          value: `${info.cpu.brand.trim()} · ${l.cores(info.cpu.physicalCores, info.cpu.threads)}`,
        }
      : null,
    ...info.gpus.map((g, i): Fact => {
      const mem = g.dedicatedBytes > 0 ? ` · ${l.gpuMemory(formatBytes(g.dedicatedBytes))}` : '';
      return { id: `gpu-${i}`, label: i === 0 ? l.gpu : '', value: `${g.name}${mem}` };
    }),
    {
      id: 'ram',
      label: l.ram,
      value: [formatBytes(info.memory.totalBytes), ramSummary(hw.ram)].filter(Boolean).join(' · '),
    },
    hw.board ? { id: 'board', label: l.board, value: hw.board } : null,
    hw.bios ? { id: 'bios', label: l.bios, value: hw.bios } : null,
    ...hw.displays.map((d, i): Fact => ({
      id: `display-${i}`,
      label: i === 0 ? l.display : '',
      value: l.displayValue(d.width, d.height, d.refreshHz),
    })),
    appVersion ? { id: 'app', label: l.app, value: appVersion } : null,
  ];
  return facts.filter((f): f is Fact => f !== null && f.value.trim() !== '');
}

/** The passport as plain text for a support message: "Label: value" per line, continuation lines indented. */
export const passportText = (title: string, facts: readonly Fact[]): string =>
  [title, ...facts.map((f) => (f.label ? `${f.label}: ${f.value}` : `  ${f.value}`))].join('\n');

/** "Android 14" from the WebView's user agent; `null` when it does not say. */
export function androidVersion(userAgent: string): string | null {
  const m = /Android (\d+(?:\.\d+)?)/.exec(userAgent);
  return m ? m[1]! : null;
}

/** Battery wear in words: share of the original capacity (never above 100) and a calm word for it. */
export function batteryWear(
  designMwh: number,
  fullMwh: number,
): {
  percent: number;
  state: 'good' | 'worn' | 'weak';
} | null {
  if (designMwh <= 0 || fullMwh <= 0) return null;
  const percent = Math.min(100, Math.round((fullMwh / designMwh) * 100));
  return { percent, state: percent >= 80 ? 'good' : percent >= 60 ? 'worn' : 'weak' };
}
