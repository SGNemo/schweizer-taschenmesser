// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setPlatform } from '@/core/platform';
import type { DriveInfo } from '@/core/platform/disk';
import { createFakeSystem } from '@/core/platform/fakeSystem';
import type { PlatformKind, PlatformService } from '@/core/platform/types';
import { createWebPlatform } from '@/core/platform/web';
import { setNow } from '@/core/time/now';
import StatusPage from '../routes/StatusPage';

const GB = 1024 ** 3;
const drives: DriveInfo[] = [
  {
    root: 'Q:\\',
    label: 'CanaryVolume',
    fileSystem: 'NTFS',
    kind: 'fixed',
    media: 'ssd',
    totalBytes: 500 * GB,
    freeBytes: 120 * GB,
    bus: 'nvme',
    model: 'CanaryDisk 9000',
    isSystem: true,
    health: { status: 'ok', temperatureC: 38, gap: null },
  },
  {
    root: 'R:\\',
    label: 'CanaryData',
    fileSystem: 'NTFS',
    kind: 'fixed',
    media: 'hdd',
    totalBytes: 2000 * GB,
    freeBytes: 1000 * GB,
    bus: 'sata',
    model: 'CanaryDisk 2',
    isSystem: false,
    health: { status: 'unknown', temperatureC: null, gap: 'needsAdmin' },
  },
];

let copied: string[] = [];

function platform(kind: PlatformKind, system = createFakeSystem()): PlatformService {
  const web = createWebPlatform();
  return {
    ...web,
    kind,
    isNative: kind !== 'web',
    system: kind === 'desktop' ? system : web.system,
    disk:
      kind === 'desktop'
        ? { ...web.disk, supported: true, listDrives: async () => drives }
        : web.disk,
    app: { ...web.app, version: async () => '9.8.7' },
    clipboard: {
      ...web.clipboard,
      writeText: async (text: string) => {
        copied.push(text);
      },
    },
  };
}

async function settle(ms = 100) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function show(p: PlatformService) {
  setPlatform(p);
  const view = render(
    <MemoryRouter>
      <StatusPage />
    </MemoryRouter>,
  );
  await settle();
  return view;
}

beforeEach(async () => {
  copied = [];
  localStorage.clear();
  setNow(() => new Date(2026, 10, 15, 10, 0).getTime());
  await db.table('_meta').clear();
});
afterEach(() => {
  setPlatform(undefined);
  setNow();
  vi.restoreAllMocks();
});

describe('Gerätestatus – live facts on the PC', () => {
  it('shows load, memory, network, battery, connection and uptime, the busiest programs, the drives and the passport', async () => {
    await show(platform('desktop'));
    expect(screen.getByRole('heading', { level: 2, name: 'Gerade jetzt' })).toBeVisible();
    expect(screen.getByTestId('device-live-cpu')).toHaveTextContent('8 Kerne, 16 Threads');
    expect(screen.getByTestId('device-live-memory')).toHaveTextContent('59 %');
    expect(screen.getByTestId('device-live-memory')).toHaveTextContent('9,5 GB von 16 GB belegt');
    expect(screen.getByTestId('device-live-network')).toHaveTextContent('↓ 1,5 MB/s');
    expect(screen.getByTestId('device-live-battery')).toHaveTextContent('64 %');
    expect(screen.getByTestId('device-live-battery')).toHaveTextContent('Lädt');
    expect(screen.getByTestId('device-live-connection')).toHaveTextContent('WLAN');
    expect(screen.getByTestId('device-live-connection')).toHaveTextContent('Starkes Signal');
    expect(screen.getByTestId('device-live-uptime')).toHaveTextContent('3 Tagen, 5 Std.');
    const programs = screen.getByTestId('device-programs');
    expect(programs).toHaveTextContent('browser.exe');
    expect(programs).not.toHaveTextContent('dienst.exe'); // no CPU share: left out
    fireEvent.click(screen.getByRole('button', { name: 'Nach Arbeitsspeicher' }));
    expect(screen.getByTestId('device-programs')).toHaveTextContent('dienst.exe');
    const items = screen.getAllByTestId('device-drive-item');
    expect(items[0]).toHaveTextContent('Systemlaufwerk · SSD');
    expect(items[0]).toHaveTextContent('Gesund · 38 °C');
    expect(items[1]).toHaveTextContent('Laufwerk 2 · Festplatte');
    expect(items[1]).toHaveTextContent('Administratorrechten');
    expect(screen.getByTestId('device-passport')).toHaveTextContent('Beispiel Mainboard B650');
    expect(screen.getByTestId('device-passport')).toHaveTextContent('9.8.7');
    // A second graphics card is another value of "Grafik", not an unnamed term.
    const terms = [...screen.getByTestId('device-passport').querySelectorAll('dt')];
    expect(terms.every((dt) => dt.textContent !== '')).toBe(true);
  });

  it('never prints an address, a network or adapter name, a drive letter, label or model, or an audio device', async () => {
    await show(platform('desktop'));
    const text = document.body.textContent ?? '';
    for (const canary of [
      '192.168.1.20',
      '172.20',
      '2001:db8',
      'Beispiel-WLAN',
      'vEthernet',
      'Q:\\',
      'CanaryVolume',
      'CanaryDisk',
      'Lautsprecher',
      'Mikrofon',
    ])
      expect(text, canary).not.toContain(canary);
  });

  it('"Als Text kopieren" copies the passport as plain lines, without addresses or names', async () => {
    await show(platform('desktop'));
    fireEvent.click(screen.getByTestId('device-passport-copy'));
    await settle(10);
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatch(
      /^Nemo – Steckbrief dieses Geräts\nSystem: Beispiel-Betriebssystem 11\n/,
    );
    expect(copied[0]).toContain('Prozessor: Beispiel-Prozessor 3000 · 8 Kerne, 16 Threads');
    expect(copied[0]).not.toMatch(/192\.168|Beispiel-WLAN|Lautsprecher|Q:/);
  });

  it('reads every three seconds while visible, not while hidden, not while paused – and the pause is kept', async () => {
    const system = createFakeSystem();
    const info = vi.spyOn(system, 'info');
    const view = await show(platform('desktop', system));
    expect(info).toHaveBeenCalledTimes(1);
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      view.unmount();
      info.mockClear();
      await show(platform('desktop', system));
      expect(info).toHaveBeenCalledTimes(1);
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      expect(info).toHaveBeenCalledTimes(2);
      // Hidden window: no reading.
      const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
      await act(async () => {
        vi.advanceTimersByTime(9000);
      });
      expect(info).toHaveBeenCalledTimes(2);
      hidden.mockRestore();
      // Paused: no reading, and the page says so.
      fireEvent.click(screen.getByTestId('device-live-pause'));
      expect(screen.getByTestId('device-live-pause')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('device-live')).toHaveTextContent('Angehalten');
      await act(async () => {
        vi.advanceTimersByTime(9000);
      });
      expect(info).toHaveBeenCalledTimes(2);
      expect(localStorage.getItem('tm-device-live-paused')).toBe('1');
      // "Weiter" reads again at once and every three seconds after that.
      fireEvent.click(screen.getByTestId('device-live-pause'));
      await act(async () => {
        await Promise.resolve();
      });
      expect(info).toHaveBeenCalledTimes(3);
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      expect(info).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Gerätestatus – reading only while seen', () => {
  it('a window that shows again reads at once; leaving the page stops the reading', async () => {
    const system = createFakeSystem();
    const info = vi.spyOn(system, 'info');
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      const view = await show(platform('desktop', system));
      expect(info).toHaveBeenCalledTimes(1);
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });
      expect(info).toHaveBeenCalledTimes(2);
      view.unmount();
      await act(async () => {
        vi.advanceTimersByTime(30_000);
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(info).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('phone: a page left before the battery answers attaches no listener', async () => {
    let answer: (b: unknown) => void = () => undefined;
    const added: string[] = [];
    Object.defineProperty(navigator, 'getBattery', {
      configurable: true,
      value: () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    });
    try {
      const view = await show(platform('android'));
      view.unmount();
      await act(async () => {
        answer({
          level: 0.5,
          charging: true,
          addEventListener: (type: string) => added.push(type),
          removeEventListener: () => undefined,
        });
        await Promise.resolve();
      });
      expect(added).toEqual([]);
    } finally {
      delete (navigator as { getBattery?: unknown }).getBattery;
    }
  });
});

describe('Gerätestatus – the phone and the browser', () => {
  it('phone: battery from the WebView and a short passport (Android and Nemo version)', async () => {
    const listeners: string[] = [];
    Object.defineProperty(navigator, 'getBattery', {
      configurable: true,
      value: async () => ({
        level: 0.42,
        charging: false,
        addEventListener: (type: string) => listeners.push(type),
        removeEventListener: () => undefined,
      }),
    });
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
    );
    try {
      await show(platform('android'));
      expect(screen.getByTestId('device-live-battery')).toHaveTextContent('42 %');
      expect(screen.getByTestId('device-live-battery')).toHaveTextContent('Im Akkubetrieb');
      expect(listeners).toEqual(['levelchange', 'chargingchange']);
      expect(screen.getByTestId('device-passport')).toHaveTextContent('SystemAndroid 14');
      expect(screen.getByTestId('device-passport')).toHaveTextContent('9.8.7');
      expect(screen.queryByTestId('device-programs')).toBeNull();
    } finally {
      delete (navigator as { getBattery?: unknown }).getBattery;
    }
  });

  it('browser: none of it (a desktop browser would report a battery a PC does not have)', async () => {
    Object.defineProperty(navigator, 'getBattery', {
      configurable: true,
      value: async () => ({
        level: 1,
        charging: true,
        addEventListener() {},
        removeEventListener() {},
      }),
    });
    try {
      await show(platform('web'));
      expect(screen.queryByTestId('device-live')).toBeNull();
      expect(screen.queryByTestId('device-passport')).toBeNull();
      expect(screen.queryByText(/Akku/)).toBeNull();
    } finally {
      delete (navigator as { getBattery?: unknown }).getBattery;
    }
  });
});
