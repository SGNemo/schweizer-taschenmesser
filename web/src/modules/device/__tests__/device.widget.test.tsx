// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { useSyncStatus } from '@/core/sync/status';
import { WidgetSizeContext } from '@/ui/widgets/size';
import DeviceWidget from '../widgets/DeviceWidget';

async function view(size: 's' | 'l' = 's') {
  const out = render(
    <MemoryRouter>
      <WidgetSizeContext.Provider value={size}>
        <DeviceWidget />
      </WidgetSizeContext.Provider>
    </MemoryRouter>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  return out;
}

afterEach(async () => {
  useSyncStatus.setState({ phase: 'off', server: undefined });
  setPlatform(undefined);
  await db.table('_meta').delete('backup.auto.config');
});

describe('device widget (catalogue type: status)', () => {
  it('says "Nichts Dringendes" while nothing needs a look; it has no link of its own (the header leads to the page)', async () => {
    await view();
    expect(screen.getByText('Nichts Dringendes')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('names the one thing that needs a look, in words; size l adds the context line', async () => {
    useSyncStatus.setState({ phase: 'error', server: 'sync.canary-server.example' });
    const out = await view('l');
    expect(screen.getByText('Sync: Fehler beim Abgleich')).toBeInTheDocument();
    expect(screen.getByText(/^Kein Backup · Sync: Fehler beim Abgleich$/)).toBeInTheDocument();
    expect(out.container.innerHTML).not.toContain('canary-server');
  });

  it('names a missing backup passphrase like the page does (never "Nichts Dringendes" then)', async () => {
    const web = createWebPlatform();
    setPlatform({
      ...web,
      isNative: true,
      secrets: { ...web.secrets, has: async () => false },
    });
    await db.table('_meta').put({
      key: 'backup.auto.config',
      value: { enabled: true, interval: 'daily', keep: 7 },
    });
    await view();
    expect(screen.getByText('Nächstes Backup: Passphrase fehlt')).toBeInTheDocument();
    expect(screen.queryByText('Nichts Dringendes')).toBeNull();
  });

  it('shows no hub port, pairing code, device name or passphrase, whatever the platform hands over', async () => {
    const web = createWebPlatform();
    setPlatform({
      ...web,
      kind: 'desktop',
      isNative: true,
      // the canary stays: should anything read the passphrase again, it must still not show
      secrets: { ...web.secrets, get: async () => 'canary-passphrase', has: async () => true },
      lanHub: {
        ...web.lanHub,
        supported: true,
        status: async () => ({
          running: true,
          state: 'failed',
          blocked: false,
          port: 47123,
          pairingOpen: true,
          qr: 'NEMO1:canary-qr',
          pending: { attempt: 1, name: 'Canary-Handy', code: '424242' },
          devices: 2,
        }),
      },
    });
    const out = await view('l');
    // The hub's mark arrives in words; nothing it carried does.
    expect(screen.getByText('Heimnetz: Nicht erreichbar')).toBeInTheDocument();
    for (const canary of ['canary-passphrase', '47123', 'canary-qr', 'Canary-Handy', '424242'])
      expect(out.container.innerHTML, canary).not.toContain(canary);
  });
});
