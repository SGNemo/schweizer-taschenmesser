// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  download: vi.fn(async () => 'saved' as 'saved' | 'cancelled'),
  disconnect: vi.fn(async () => undefined),
  lock: vi.fn(async () => true),
  devices: vi.fn(async () => [
    { id: 'me', name: 'Dieser PC', current: true, revokedAt: null },
    { id: 'p7', name: 'Pixel 7', current: false, revokedAt: null },
    { id: 'old', name: 'Altes Handy', current: false, revokedAt: 1 },
  ]),
}));

vi.mock('@/core/backup/backup', () => ({
  backupFileName: () => 'nemo.json',
  createBackup: vi.fn(async () => ({})),
}));
vi.mock('@/core/backup/encrypted', () => ({ serializeSealedBackup: vi.fn(async () => '{}') }));
vi.mock('@/core/backup/download', () => ({ downloadTextFile: m.download }));
vi.mock('@/core/backup/lastBackup', () => ({ recordFileBackup: vi.fn(async () => undefined) }));
vi.mock('@/core/sync/service', () => ({
  disconnect: m.disconnect,
  fetchDevices: m.devices,
  lockDevice: m.lock,
}));

import { SwitchToLanDialog } from './SwitchToLanDialog';

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));

beforeEach(() => {
  m.download.mockClear().mockResolvedValue('saved');
  m.disconnect.mockClear();
  m.lock.mockClear().mockResolvedValue(true);
});

describe('SwitchToLanDialog (server → home network)', () => {
  it('backup first, then disconnect; the other devices are listed and can be locked', async () => {
    const onClose = vi.fn();
    render(<SwitchToLanDialog open onClose={onClose} />);
    await flush();
    const leave = screen.getByTestId('lan-switch-disconnect') as HTMLButtonElement;
    expect(leave.disabled).toBe(true);

    // only devices that still sync through the server, never this one or a locked one
    const list = screen.getByTestId('lan-switch-devices');
    expect(list.textContent).toContain('Pixel 7');
    expect(list.textContent).not.toContain('Dieser PC');
    expect(list.textContent).not.toContain('Altes Handy');
    fireEvent.click(screen.getByText('Am Server sperren'));
    await flush();
    expect(m.lock).toHaveBeenCalledWith('p7');
    expect(list.textContent).toContain('Gesperrt');

    fireEvent.click(screen.getByTestId('lan-switch-backup'));
    await flush();
    expect(screen.getByTestId('lan-switch-saved')).toBeTruthy();
    expect(leave.disabled).toBe(false);
    fireEvent.click(leave);
    await flush();
    expect(m.disconnect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('a cancelled save keeps "Vom Server trennen" closed', async () => {
    m.download.mockResolvedValue('cancelled');
    render(<SwitchToLanDialog open onClose={vi.fn()} />);
    await flush();
    fireEvent.click(screen.getByTestId('lan-switch-backup'));
    await flush();
    expect((screen.getByTestId('lan-switch-disconnect') as HTMLButtonElement).disabled).toBe(true);
    expect(m.disconnect).not.toHaveBeenCalled();
  });
});
