// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { DEFAULTS_VERSION_KEY } from '@/core/modules/defaults';
import { tSettingsV3 } from '@/strings.settingsV3';
import { StatusHead } from './StatusHead';

describe('settings status head', () => {
  afterEach(async () => {
    await db.table('_meta').delete(DEFAULTS_VERSION_KEY);
  });

  it('shows the six states, each a link into its category with a context line', async () => {
    render(
      <MemoryRouter>
        <StatusHead title="Einstellungen" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
    const list = screen.getByTestId('settings-status');
    const links = within(list).getAllByRole('link');
    expect(links).toHaveLength(6);
    const ids = ['security', 'sync', 'backup', 'updates', 'ai', 'storage'].map(
      (id) => `overview-${id}`,
    );
    expect(links.map((l) => l.getAttribute('data-testid'))).toEqual(ids);
    for (const l of links) {
      expect(l.getAttribute('href')).toMatch(/^\/settings\//);
      // name + state + context: three text lines per tile (a number never stands alone)
      expect(l.querySelectorAll('span')).toHaveLength(3);
    }
    expect(within(list).getByText(tSettingsV3.get().tiles.backup)).toBeInTheDocument();
    // The tiles load their states (backup, version, …) asynchronously. Let those loads finish inside the test:
    // if they resolve after the file's last test, the jsdom is gone and React fails with "window is not defined"
    // as an unhandled error (seen when the file ends a worker, e.g. with vitest --shard).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  // Module package S-b: only a device that has "Gerätestatus" switched on sees one line instead of the four.
  it('with the module device on: sync, backup, updates and storage are one line that leads to /device; security and AI stay', async () => {
    await db.table('_meta').put({ key: DEFAULTS_VERSION_KEY, value: 6 });
    render(
      <MemoryRouter>
        <StatusHead title="Einstellungen" />
      </MemoryRouter>,
    );
    const device = await screen.findByTestId('overview-device');
    expect(device).toHaveAttribute('href', '/device');
    expect(device).toHaveTextContent('Gerätestatus');
    expect(device).toHaveTextContent('Nichts Dringendes');
    const links = within(screen.getByTestId('settings-status')).getAllByRole('link');
    expect(links.map((l) => l.getAttribute('data-testid'))).toEqual([
      'overview-security',
      'overview-device',
      'overview-ai',
    ]);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  it('a device that started with set 5 keeps the six lines after the update', async () => {
    await db.table('_meta').put({ key: DEFAULTS_VERSION_KEY, value: 5 });
    render(
      <MemoryRouter>
        <StatusHead title="Einstellungen" />
      </MemoryRouter>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(screen.queryByTestId('overview-device')).toBeNull();
    expect(within(screen.getByTestId('settings-status')).getAllByRole('link')).toHaveLength(6);
  });
});
