import { describe, expect, it } from 'vitest';
import type { GpuInfo, NetIface, RamModule } from '@/core/platform/system';
import { useSystemLive, LIVE_POINTS } from '../live';
import { createFakeSystem } from '@/core/platform/fakeSystem';
import {
  formatRate,
  gpuMemory,
  ramSummary,
  signalLabel,
  splitAdapters,
  totalRates,
} from '../logic/system';

const GB = 1024 ** 3;
const iface = (p: Partial<NetIface>): NetIface => ({
  name: 'x',
  kind: 'ethernet',
  up: true,
  ipv4: [],
  ipv6: null,
  ipv6Other: [],
  ssid: null,
  signalPercent: null,
  downBytesPerSec: null,
  upBytesPerSec: null,
  ...p,
});

describe('formatRate', () => {
  it('scales and survives missing values', () => {
    expect(formatRate(512)).toBe('512 B/s');
    expect(formatRate(2048)).toBe('2 KB/s');
    expect(formatRate(1.5 * 1024 ** 2)).toBe('1,5 MB/s');
    expect(formatRate(null)).toBe('–');
    expect(formatRate(-5)).toBe('–');
  });
});

describe('totalRates', () => {
  it('adds real adapters only', () => {
    const r = totalRates([
      iface({ downBytesPerSec: 100, upBytesPerSec: 10 }),
      iface({ kind: 'wifi', downBytesPerSec: 50, upBytesPerSec: 5 }),
      iface({ kind: 'virtual', downBytesPerSec: 9999, upBytesPerSec: 9999 }),
      iface({ up: false, downBytesPerSec: 777, upBytesPerSec: 7 }),
    ]);
    expect(r).toEqual({ down: 150, up: 15 });
  });
  it('is null without any reading', () => {
    expect(totalRates([iface({})])).toBeNull();
    expect(totalRates([])).toBeNull();
  });
});

describe('ramSummary', () => {
  const m = (
    size: number,
    speed: number | null = 6000,
    kind: string | null = 'DDR5',
  ): RamModule => ({
    sizeBytes: size * GB,
    speedMhz: speed,
    kind,
    manufacturer: null,
  });
  it('groups equal modules', () => {
    expect(ramSummary([m(8), m(8)])).toBe('2 × 8,0 GB DDR5 · 6000 MHz');
  });
  it('lists mixed modules and handles unknown details', () => {
    expect(ramSummary([m(8), m(16, null, null)])).toBe('1 × 8,0 GB DDR5 · 6000 MHz, 1 × 16,0 GB');
    expect(ramSummary([])).toBeNull();
  });
});

describe('gpuMemory', () => {
  const g = (dedicatedBytes: number, sharedBytes?: number): GpuInfo => ({
    name: 'x',
    dedicatedBytes,
    sharedBytes,
  });
  it('tells own from shared memory', () => {
    expect(gpuMemory(g(12 * GB, 16 * GB))).toEqual({ kind: 'own', bytes: 12 * GB });
    expect(gpuMemory(g(0, 8 * GB))).toEqual({ kind: 'shared', bytes: 8 * GB });
    expect(gpuMemory(g(0))).toEqual({ kind: 'none', bytes: 0 });
  });
});

describe('signal and adapters', () => {
  it('words for signal strength', () => {
    expect(signalLabel(80)).toBe('strong');
    expect(signalLabel(50)).toBe('ok');
    expect(signalLabel(10)).toBe('weak');
    expect(signalLabel(null)).toBeNull();
  });
  it('splits virtual adapters off', () => {
    const { real, virtual } = splitAdapters([
      iface({ name: 'a' }),
      iface({ name: 'v', kind: 'virtual' }),
    ]);
    expect(real.map((n) => n.name)).toEqual(['a']);
    expect(virtual.map((n) => n.name)).toEqual(['v']);
  });
});

describe('live history (memory only)', () => {
  it('keeps a bounded series per metric', async () => {
    const sys = createFakeSystem();
    useSystemLive.getState().clear();
    for (let i = 0; i < LIVE_POINTS + 20; i++)
      useSystemLive.getState().update(await sys.info(), await sys.processes(), await sys.diskIo());
    const s = useSystemLive.getState();
    expect(s.cpu).toHaveLength(LIVE_POINTS);
    expect(s.ram).toHaveLength(LIVE_POINTS);
    expect(s.down).toHaveLength(LIVE_POINTS);
    expect(s.info?.os).toContain('Betriebssystem');
    s.clear();
    expect(useSystemLive.getState().cpu).toEqual([]);
  });
});
