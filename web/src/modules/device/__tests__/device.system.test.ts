import { describe, expect, it } from 'vitest';
import type { DriveInfo } from '@/core/platform/disk';
import { createFakeSystem } from '@/core/platform/fakeSystem';
import type { NetIface } from '@/core/platform/system';
import { t } from '@/strings';
import {
  LIVE_POINTS,
  androidVersion,
  batteryWear,
  connection,
  driveViews,
  passport,
  passportText,
  percentOf,
  pushPoint,
  ramSummary,
  topPrograms,
  totalRates,
  uptimeParts,
} from '../system';

const GB = 1024 ** 3;
const iface = (over: Partial<NetIface>): NetIface => ({
  name: 'Canary-Adapter',
  kind: 'ethernet',
  up: true,
  ipv4: ['192.168.77.7'],
  ipv6: null,
  ipv6Other: [],
  ssid: null,
  signalPercent: null,
  downBytesPerSec: 100,
  upBytesPerSec: 10,
  ...over,
});
const labels = () => ({ ...t.device.passport, cores: t.device.live.cores });

describe('live history', () => {
  it('keeps the last two minutes and skips readings that are no number', () => {
    let list: number[] = [];
    for (let i = 0; i < LIVE_POINTS + 5; i++) list = pushPoint(list, i);
    expect(list).toHaveLength(LIVE_POINTS);
    expect(list[0]).toBe(5);
    expect(pushPoint([1], Number.NaN)).toEqual([1]);
  });
  it('percent is whole, clamped and 0 without a total', () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(9, 4)).toBe(100);
  });
});

describe('network in words', () => {
  it('sums only connected real adapters; virtual ones would count the traffic twice', () => {
    expect(
      totalRates([
        iface({}),
        iface({ kind: 'virtual', downBytesPerSec: 999 }),
        iface({ up: false }),
      ]),
    ).toEqual({ down: 100, up: 10 });
    expect(totalRates([iface({ downBytesPerSec: null, upBytesPerSec: null })])).toBeNull();
    expect(totalRates([])).toBeNull();
  });
  it('cable wins over Wi-Fi; Wi-Fi says its signal in words; nothing connected is null', () => {
    expect(connection([iface({ kind: 'wifi', signalPercent: 80 }), iface({})])).toEqual({
      kind: 'ethernet',
      signal: null,
    });
    expect(connection([iface({ kind: 'wifi', signalPercent: 50 })])?.signal).toBe('ok');
    expect(connection([iface({ kind: 'wifi', signalPercent: 10 })])?.signal).toBe('weak');
    expect(connection([iface({ kind: 'wifi', signalPercent: null })])?.signal).toBeNull();
    expect(connection([iface({ up: false })])).toBeNull();
  });
});

describe('programs', () => {
  const procs = [
    { name: 'a.exe', memoryBytes: 3, instances: 1, cpuPercent: 0 },
    { name: 'b.exe', memoryBytes: 1, instances: 2, cpuPercent: 9 },
    { name: 'c.exe', memoryBytes: 2, instances: 1, cpuPercent: 4 },
  ];
  it('the busiest first, programs without a share left out, at most n', () => {
    expect(topPrograms(procs, 'cpu').map((p) => p.name)).toEqual(['b.exe', 'c.exe']);
    expect(topPrograms(procs, 'memory', 2).map((p) => p.name)).toEqual(['a.exe', 'c.exe']);
  });
});

describe('facts', () => {
  it('uptime in days, hours and minutes', () => {
    expect(uptimeParts(2 * 86_400 + 3 * 3600 + 4 * 60 + 59)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
    });
    expect(uptimeParts(-5)).toEqual({ days: 0, hours: 0, minutes: 0 });
  });
  it('equal memory modules are grouped', () => {
    const m = { sizeBytes: 8 * GB, speedMhz: 6000, kind: 'DDR5', manufacturer: 'X' };
    expect(ramSummary([m, m])).toBe('2 × 8 GB DDR5 · 6000 MHz');
    expect(ramSummary([])).toBeNull();
  });
  it('Android version from the user agent', () => {
    expect(androidVersion('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit')).toBe('14');
    expect(androidVersion('Mozilla/5.0 (Linux; Android 12.1; X)')).toBe('12.1');
    expect(androidVersion('Mozilla/5.0 (Windows NT 10.0)')).toBeNull();
  });
});

describe('drives', () => {
  const drive = (over: Partial<DriveInfo>): DriveInfo => ({
    root: 'Q:\\',
    label: 'CanaryVolume',
    fileSystem: 'NTFS',
    kind: 'fixed',
    media: 'ssd',
    totalBytes: 100 * GB,
    freeBytes: 25 * GB,
    bus: 'nvme',
    model: 'CanaryDisk 9000',
    isSystem: false,
    health: { status: 'ok', temperatureC: 41, gap: null },
    ...over,
  });
  it('fixed drives only, the system drive first, without letter, label or model', () => {
    const views = driveViews([
      drive({}),
      drive({ kind: 'removable' }),
      drive({
        isSystem: true,
        health: { status: 'unknown', temperatureC: null, gap: 'needsAdmin' },
      }),
      drive({ totalBytes: 0 }),
    ]);
    expect(views).toHaveLength(2);
    expect(views[0]).toMatchObject({ system: true, health: 'unknown', gap: 'needsAdmin' });
    expect(views[1]).toMatchObject({ system: false, usedPercent: 75, temperatureC: 41 });
    const text = JSON.stringify(views);
    for (const canary of ['Q:', 'CanaryVolume', 'CanaryDisk']) expect(text).not.toContain(canary);
  });
});

describe('hardware passport', () => {
  it('names what the machine is, never an address, a network, an adapter or an audio device', async () => {
    const info = await createFakeSystem().info();
    const facts = passport(info, '1.2.3', labels());
    const text = passportText(t.device.passport.textTitle, facts);
    expect(text).toContain('Beispiel-Prozessor 3000');
    expect(text).toContain('8 Kerne, 16 Threads');
    expect(text).toContain('Beispiel-Grafik 4000');
    expect(text).toContain('Beispiel Mainboard B650');
    expect(text).toContain('Beispiel BIOS F31');
    expect(text).toContain('2 × 8 GB DDR5 · 6000 MHz');
    expect(text).toContain('2560 × 1440 · 144 Hz');
    expect(text).toContain('Nemo-Version: 1.2.3');
    for (const canary of [
      '192.168',
      '172.20',
      '2001:db8',
      'Beispiel-WLAN',
      'WLAN',
      'vEthernet',
      'Lautsprecher',
      'Mikrofon',
    ])
      expect(text).not.toContain(canary);
    // A second GPU continues the line without a label.
    expect(text).toMatch(/\n {2}Beispiel-Prozessorgrafik/);
  });
  it('leaves out what Windows does not tell (no "unbekannt" lines)', async () => {
    const info = await createFakeSystem().info();
    const bare = {
      ...info,
      gpus: [],
      hardware: {
        ...info.hardware,
        board: null,
        bios: null,
        windowsBuild: null,
        displays: [],
        ram: [],
      },
    };
    expect(passport(bare, null, labels()).map((f) => f.id)).toEqual(['os', 'cpu', 'ram']);
  });
});

describe('battery wear', () => {
  it('share of the original capacity, never above 100, in three calm words', () => {
    expect(batteryWear(57_000, 48_450)).toEqual({ percent: 85, state: 'good' });
    expect(batteryWear(50_000, 35_000)).toEqual({ percent: 70, state: 'worn' });
    expect(batteryWear(50_000, 20_000)).toEqual({ percent: 40, state: 'weak' });
    expect(batteryWear(50_000, 52_000)).toEqual({ percent: 100, state: 'good' });
    expect(batteryWear(0, 1)).toBeNull();
  });
});
