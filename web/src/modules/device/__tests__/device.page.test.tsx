// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNetworkBlocked } from '@/core/net/netlog';
import { setPlatform } from '@/core/platform';
import type { DriveInfo } from '@/core/platform/disk';
import { createWebPlatform } from '@/core/platform/web';
import type { PlatformKind, PlatformService } from '@/core/platform/types';
import { useSyncStatus } from '@/core/sync/status';
import { setNow } from '@/core/time/now';
import StatusPage from '../routes/StatusPage';
import DeviceWidget from '../widgets/DeviceWidget';

/** Things the platform knows and the page must never print. */
const CANARIES = {
  server: 'sync.canary-server.example',
  port: 47123,
  qr: 'nemo-lan:CANARY-PAIRING-SECRET',
  pendingName: 'Canary-Handy',
  driveRoot: 'Q:\\',
  driveLabel: 'CanaryVolume',
  driveModel: 'CanaryDisk 9000',
  dataDir: 'C:\\Users\\canary\\AppData\\Nemo',
};

const GB = 1024 ** 3;
const drive: DriveInfo = {
  root: CANARIES.driveRoot,
  label: CANARIES.driveLabel,
  fileSystem: 'NTFS',
  kind: 'fixed',
  media: 'ssd',
  totalBytes: 500 * GB,
  freeBytes: 120 * GB,
  bus: 'nvme',
  model: CANARIES.driveModel,
  isSystem: true,
  health: { status: 'unknown' } as DriveInfo['health'],
};

function platformOf(kind: PlatformKind): PlatformService {
  const web = createWebPlatform();
  if (kind !== 'desktop') return { ...web, kind };
  return {
    ...web,
    kind,
    isNative: true,
    lanHub: {
      ...web.lanHub,
      supported: true,
      status: async () => ({
        running: true,
        state: 'listening',
        blocked: false,
        port: CANARIES.port,
        pairingOpen: true,
        qr: CANARIES.qr,
        pending: { attempt: 1, name: CANARIES.pendingName, code: '424242' },
        devices: 2,
      }),
    },
    disk: { ...web.disk, supported: true, listDrives: async () => [drive] },
    desktop: {
      ...web.desktop,
      supported: true,
      autostart: async () => true,
      dataDir: async () => CANARIES.dataDir,
    },
  };
}

async function show(kind: PlatformKind, over: Partial<PlatformService> = {}) {
  setPlatform({ ...platformOf(kind), ...over });
  const view = render(
    <MemoryRouter>
      <StatusPage />
      <DeviceWidget />
    </MemoryRouter>,
  );
  // The lines load their states asynchronously; let the reads finish inside the test.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  return view;
}

/** The status lines (the pointer to "Dieser PC" below them is a plain link without a test id). */
const lines = () =>
  within(screen.getByTestId('device-status'))
    .getAllByRole('link')
    .filter((l) => l.hasAttribute('data-testid'));
const ids = () => lines().map((l) => l.getAttribute('data-testid'));

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 13, 10, 0).getTime());
  await db.table('_meta').clear();
  useSyncStatus.setState({ phase: 'off', server: undefined, lastSyncAt: undefined });
});
afterEach(() => {
  setPlatform(undefined);
  setNetworkBlocked(false);
  setNow();
});

describe('page Gerätestatus', () => {
  it('desktop: backup last and next, sync and hub, storage and drive, updates, autostart, network; each a link into the settings', async () => {
    await show('desktop');
    expect(screen.getByRole('heading', { level: 1, name: 'Gerätestatus' })).toBeVisible();
    expect(ids()).toEqual([
      'overview-backup',
      'device-next-backup',
      'overview-sync',
      'device-hub',
      'overview-storage',
      'device-drive',
      'overview-updates',
      'device-autostart',
      'device-network',
    ]);
    for (const l of lines())
      expect(l.getAttribute('href'), l.textContent ?? '').toMatch(/^\/settings\//);
    expect(screen.getByTestId('device-hub')).toHaveTextContent('Aktiv');
    expect(screen.getByTestId('device-hub')).toHaveTextContent('2 Geräte gekoppelt');
    expect(screen.getByTestId('device-drive')).toHaveTextContent('120 GB frei');
    expect(screen.getByTestId('device-drive')).toHaveTextContent('von 500 GB');
    expect(screen.getByTestId('device-autostart')).toHaveTextContent('An');
    expect(screen.getByTestId('device-next-backup')).toHaveTextContent('Nicht geplant');
    expect(screen.getByTestId('device-network')).toHaveTextContent('Erlaubt');
    // CPU, memory and network are not repeated: the page points to "Dieser PC".
    expect(screen.getByTestId('device-pc')).toHaveTextContent('Dieser PC');
    expect(screen.queryByText(/CPU|Prozessorlast|Akku/)).toBeNull();
  });

  it('shows states only: nothing is a switch or a button', async () => {
    await show('desktop');
    const page = screen.getByTestId('device-status');
    expect(within(page).queryAllByRole('button')).toEqual([]);
    expect(within(page).queryAllByRole('switch')).toEqual([]);
    expect(within(page).queryAllByRole('checkbox')).toEqual([]);
  });

  it('phone and browser: the same page with sync, storage, backup, updates and network; no hub, drive, autostart or battery', async () => {
    for (const kind of ['android', 'web'] as const) {
      const view = await show(kind);
      expect(ids(), kind).toEqual([
        'overview-backup',
        'device-next-backup',
        'overview-sync',
        'overview-storage',
        'overview-updates',
        'device-network',
      ]);
      expect(screen.queryByTestId('device-pc')).toBeNull();
      expect(screen.queryByText(/Akku|Batterie/)).toBeNull();
      view.unmount();
    }
  });

  it('browser: the next backup is "Von Hand"; the app with automatic backups on names the day', async () => {
    const web = await show('web');
    expect(screen.getByTestId('device-next-backup')).toHaveTextContent('Von Hand');
    web.unmount();
    const at = new Date(2026, 10, 13, 8, 0).getTime();
    await db.table('_meta').bulkPut([
      { key: 'backup.auto.config', value: { enabled: true, interval: 'daily', keep: 7 } },
      { key: 'backup.auto.last', value: { at, ok: true } },
    ]);
    const desktop = platformOf('desktop');
    await show('desktop', {
      secrets: { ...desktop.secrets, get: async () => 'a stored passphrase' },
    });
    expect(screen.getByTestId('device-next-backup')).toHaveTextContent('14.11.2026');
    expect(screen.getByTestId('overview-backup')).toHaveTextContent('Gesichert');
  });

  it('the summary names what needs a look, and the network block is said in words', async () => {
    useSyncStatus.setState({ phase: 'error', server: CANARIES.server });
    setNetworkBlocked(true);
    await show('desktop');
    // The head's figure needs the module frame; the widget says the same sentence (one `summaryText`).
    expect(screen.getByText('Sync: Fehler beim Abgleich')).toBeInTheDocument();
    expect(screen.getByTestId('device-network')).toHaveTextContent('Gesperrt');
    // The block is the user's choice: no mark on it.
    expect(screen.getByTestId('device-network')).toHaveAttribute('data-attention', 'false');
    expect(screen.getByTestId('overview-sync')).toHaveAttribute('data-attention', 'true');
  });

  it('never prints a server address, a port, a pairing secret, a device name, a drive letter, label or model, or a path (page and widget)', async () => {
    useSyncStatus.setState({
      phase: 'idle',
      server: CANARIES.server,
      lastSyncAt: new Date(2026, 10, 13, 9, 0).getTime(),
    });
    const view = await show('desktop');
    const html = view.container.innerHTML;
    for (const [name, value] of Object.entries(CANARIES))
      expect(html, `leaked ${name}`).not.toContain(String(value));
    const text = view.container.textContent ?? '';
    expect(text).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
    expect(text).not.toMatch(/https?:\/\/|[A-Z]:\\/);
    for (const a of view.container.querySelectorAll('a'))
      expect(a.getAttribute('href')).toMatch(/^\/(settings|library|disk)\b/);
  });

  it('a hub that is on but not reachable and an automatic backup without its passphrase carry the mark, in words', async () => {
    await db.table('_meta').put({
      key: 'backup.auto.config',
      value: { enabled: true, interval: 'daily', keep: 7 },
    });
    const desktop = platformOf('desktop');
    await show('desktop', {
      lanHub: {
        ...desktop.lanHub,
        status: async () => ({
          running: true,
          state: 'failed',
          blocked: false,
          pairingOpen: false,
          devices: 1,
        }),
      },
      // No passphrase stored (only whether one exists is read).
      secrets: { ...desktop.secrets, get: async () => undefined },
    });
    expect(screen.getByTestId('device-hub')).toHaveTextContent('Nicht erreichbar');
    expect(screen.getByTestId('device-hub')).toHaveAttribute('data-attention', 'true');
    expect(screen.getByTestId('device-next-backup')).toHaveTextContent('Passphrase fehlt');
    expect(screen.getByTestId('device-next-backup')).toHaveAttribute('data-attention', 'true');
  });
});
