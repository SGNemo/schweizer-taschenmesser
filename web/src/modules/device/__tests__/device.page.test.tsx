// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNetworkBlocked } from '@/core/net/netlog';
import { setPlatform } from '@/core/platform';
import { STATUS_WAIT_MS } from '@/core/status/lines';
import type { DriveInfo } from '@/core/platform/disk';
import { createWebPlatform } from '@/core/platform/web';
import type { PlatformKind, PlatformService } from '@/core/platform/types';
import { useSyncStatus } from '@/core/sync/status';
import { setNow } from '@/core/time/now';
import { tLanSync } from '@/strings.lanSync';
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
    // Only whether a passphrase exists reaches the page, never the value.
    expect(document.body.textContent).not.toContain('a stored passphrase');
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

  for (const [reason, status, context] of [
    ['public-network', 'Windows blockiert den Abgleich', tLanSync.de.blockedLine],
    ['no-home', tLanSync.de.onlyHome, tLanSync.de.onlyHomeLine],
  ] as const)
    it(`a hub held off by the network (${reason}) does not read like "Aus": its own context line, in the settings' words, no mark`, async () => {
      const desktop = platformOf('desktop');
      await show('desktop', {
        lanHub: {
          ...desktop.lanHub,
          status: async () => ({
            running: false,
            state: 'off',
            reason,
            blocked: reason === 'public-network',
            pairingOpen: false,
            devices: 1,
          }),
        },
      });
      const hub = screen.getByTestId('device-hub');
      expect(hub.querySelectorAll('span')[1]).toHaveTextContent(status);
      expect(hub.querySelectorAll('span')[2]).toHaveTextContent(context);
      expect(hub).not.toHaveTextContent(/\bAus\b/);
      expect(hub).not.toHaveTextContent('gleicht nicht im Heimnetz ab');
      expect(hub).toHaveAttribute('data-attention', 'false');
      // Display only: it leads to the section, it never switches; nothing counts it as a point (the widget says the
      // head's sentence; the head's figure needs the module frame).
      expect(hub).toHaveAttribute('href', '/settings/sync');
      expect(screen.getByText('Nichts Dringendes')).toBeInTheDocument();
    });

  it('a hub that is simply off still says "Aus"', async () => {
    const desktop = platformOf('desktop');
    await show('desktop', {
      lanHub: {
        ...desktop.lanHub,
        status: async () => ({
          running: false,
          state: 'off',
          reason: 'nothing-wanted',
          blocked: false,
          pairingOpen: false,
          devices: 0,
        }),
      },
    });
    expect(screen.getByTestId('device-hub')).toHaveTextContent('Aus');
    expect(screen.getByTestId('device-hub')).toHaveTextContent(
      'Dieser PC gleicht nicht im Heimnetz ab',
    );
  });
});

describe('page Gerätestatus while it loads', () => {
  /** A desktop whose hub answers only when the test says so. */
  function slowHub() {
    let answer: () => void = () => undefined;
    const desktop = platformOf('desktop');
    const status = desktop.lanHub.status;
    const gate = new Promise<void>((resolve) => (answer = resolve));
    setPlatform({
      ...desktop,
      lanHub: { ...desktop.lanHub, status: async () => (await gate, status()) },
    });
    return () => answer();
  }

  it('head and lines come together once the first reads are back; never "Kein Backup" before the backup is read', async () => {
    // This device has a backup: "Kein Backup" must never stand on the page, not even for a moment.
    await db
      .table('_meta')
      .put({ key: 'backup.file.last', value: { at: new Date(2026, 10, 12, 18, 0).getTime() } });
    const answer = slowHub();
    // What the page shows at each change: never a line before the rest.
    const seen: string[][] = [];
    const record = () =>
      seen.push(
        Array.from(document.querySelectorAll('[data-testid="device-status"] a[data-testid]')).map(
          (a) => `${a.getAttribute('data-testid')}:${a.textContent}`,
        ),
      );
    const observer = new MutationObserver(record);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    render(
      <MemoryRouter>
        <StatusPage />
      </MemoryRouter>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    // Everything else is read; the hub is not: nothing shows yet, the list says it is busy.
    expect(screen.getByTestId('device-status')).toHaveAttribute('aria-busy', 'true');
    expect(within(screen.getByTestId('device-status')).queryAllByRole('link')).toEqual([]);
    expect(document.body.textContent).not.toContain('Kein Backup');
    await act(async () => {
      answer();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    observer.disconnect();
    expect(screen.getByTestId('device-status')).toHaveAttribute('aria-busy', 'false');
    expect(ids()).toHaveLength(9);
    // The first state with any line already had all nine.
    const firstWithLines = seen.find((s) => s.length > 0)!;
    expect(firstWithLines).toHaveLength(9);
    expect(seen.flat().join(' ')).not.toContain('Kein Backup');
    expect(screen.getByTestId('overview-backup')).not.toHaveTextContent('Kein Backup');
  });

  it('a read that never comes back holds the page only for a moment: the other lines show without it', async () => {
    const desktop = platformOf('desktop');
    setPlatform({
      ...desktop,
      lanHub: { ...desktop.lanHub, status: () => new Promise(() => undefined) },
    });
    render(
      <MemoryRouter>
        <StatusPage />
        <DeviceWidget />
      </MemoryRouter>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(within(screen.getByTestId('device-status')).queryAllByRole('link')).toEqual([]);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, STATUS_WAIT_MS));
    });
    expect(ids()).not.toContain('device-hub');
    expect(ids()).toContain('overview-backup');
    expect(screen.getByTestId('overview-backup')).toHaveTextContent('Kein Backup');
    // The widget waited as long, then speaks without the hub.
    expect(screen.getByText('Nichts Dringendes')).toBeInTheDocument();
  });

  it('the widget says nothing before its reads are back, then one sentence', async () => {
    const answer = slowHub();
    render(
      <MemoryRouter>
        <DeviceWidget />
      </MemoryRouter>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(document.body.textContent).toBe('');
    await act(async () => {
      answer();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(document.body.textContent).toContain('Nichts Dringendes');
  });
});
