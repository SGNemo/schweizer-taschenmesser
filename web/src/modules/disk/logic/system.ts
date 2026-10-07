import { formatNumber, formatTimestamp } from '@/core/i18n/format';
import type { GpuInfo, NetIface, RamModule, SystemInfo } from '@/core/platform/system';
import { formatCapacity } from './drives';

const KB = 1024;
const MB = KB ** 2;

/** Transfer rate for display: "812 KB/s", "1,5 MB/s". */
export function formatRate(bytesPerSec: number | null | undefined): string {
  if (bytesPerSec == null || !Number.isFinite(bytesPerSec) || bytesPerSec < 0) return '–';
  if (bytesPerSec >= MB)
    return `${formatNumber(bytesPerSec / MB, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB/s`;
  if (bytesPerSec >= KB) return `${formatNumber(Math.round(bytesPerSec / KB))} KB/s`;
  return `${Math.round(bytesPerSec)} B/s`;
}

/** Sum of the rates of real adapters (virtual ones would count the same traffic twice). */
export function totalRates(network: readonly NetIface[]): { down: number; up: number } | null {
  const real = network.filter((n) => n.kind !== 'virtual' && n.kind !== 'other' && n.up);
  if (real.every((n) => n.downBytesPerSec == null)) return null;
  return {
    down: real.reduce((s, n) => s + (n.downBytesPerSec ?? 0), 0),
    up: real.reduce((s, n) => s + (n.upBytesPerSec ?? 0), 0),
  };
}

/** "2 × 8,0 GB DDR5 · 6000 MHz" – equal modules are grouped; mixed ones are listed one by one. */
export function ramSummary(modules: readonly RamModule[]): string | null {
  if (modules.length === 0) return null;
  const key = (m: RamModule) => `${m.sizeBytes}|${m.kind}|${m.speedMhz}`;
  const groups = new Map<string, { m: RamModule; n: number }>();
  for (const m of modules) {
    const g = groups.get(key(m));
    if (g) g.n++;
    else groups.set(key(m), { m, n: 1 });
  }
  return [...groups.values()]
    .map(({ m, n }) => {
      const parts = [`${n} × ${formatCapacity(m.sizeBytes)}`];
      if (m.kind) parts[0] += ` ${m.kind}`;
      if (m.speedMhz) parts.push(`${m.speedMhz} MHz`);
      return parts.join(' · ');
    })
    .join(', ');
}

/** Video memory as a person would say it; integrated adapters borrow system memory. */
export function gpuMemory(g: GpuInfo): { kind: 'own' | 'shared' | 'none'; bytes: number } {
  if (g.dedicatedBytes > 0) return { kind: 'own', bytes: g.dedicatedBytes };
  if ((g.sharedBytes ?? 0) > 0) return { kind: 'shared', bytes: g.sharedBytes! };
  return { kind: 'none', bytes: 0 };
}

/** Signal strength in words (percent as reported by Windows). */
export function signalLabel(percent: number | null): 'strong' | 'ok' | 'weak' | null {
  if (percent == null) return null;
  return percent >= 67 ? 'strong' : percent >= 34 ? 'ok' : 'weak';
}

/** Adapters split for display: real ones first, virtual ones muted at the end. */
export function splitAdapters(network: readonly NetIface[]) {
  return {
    real: network.filter((n) => n.kind !== 'virtual'),
    virtual: network.filter((n) => n.kind === 'virtual'),
  };
}

/** Last restart as a date-time in local time (seconds since 1970 in, "12.06.2025, 08:15" out). */
export function formatBoot(bootTimeSecs: number): string {
  return formatTimestamp(bootTimeSecs * 1000, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const hasDedicatedGpu = (info: SystemInfo): boolean =>
  info.gpus.some((g) => g.dedicatedBytes > 0);
