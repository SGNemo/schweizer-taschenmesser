// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRemoteHostParts } from '@/core/platform/fakeRemoteHost';
import { useRemoteHost } from '@/core/remote/host';
import { useSyncStatus } from '@/core/sync/status';

const fake = vi.hoisted(() => ({
  parts: undefined as unknown as ReturnType<typeof createFakeRemoteHostParts>,
}));

vi.mock('@/core/platform', () => ({
  getPlatform: () => ({ kind: 'desktop', isNative: true, remoteHost: fake.parts.host }),
}));

import { RemoteChip } from '@/layout/RemoteChip';
import { RemoteHostSection } from './RemoteHostSection';

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const show = async () => {
  render(
    <MemoryRouter>
      <RemoteChip />
      <RemoteHostSection />
    </MemoryRouter>,
  );
  await flush();
};
const level = () => screen.getByTestId('remote-level') as HTMLSelectElement;
const master = () => screen.getByRole('switch', { name: 'Fernsteuerung erlauben' });

beforeEach(() => {
  fake.parts = createFakeRemoteHostParts();
  useRemoteHost.setState({ status: undefined, off: true });
  useSyncStatus.getState().set({ phase: 'off', via: undefined, encrypted: false, pending: 0 });
});

describe('RemoteHostSection (desktop)', () => {
  it('without the hub it says where to go, and shows no switch', async () => {
    fake.parts.hooks.setRunning(false);
    await show();
    const banner = screen.getByTestId('remote-need-hub');
    expect(banner.textContent).toContain('Die Fernsteuerung läuft über den Abgleich im Heimnetz.');
    expect(screen.getByRole('link', { name: 'Zum Abgleich im Heimnetz' })).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('says so on a PC that cannot be controlled', async () => {
    fake.parts.hooks.setSupported(false);
    await show();
    expect(screen.getByTestId('remote-not-windows').textContent).toContain('nur unter Windows');
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('is off first: the choice per device is inactive with one explaining sentence', async () => {
    fake.parts.hooks.addDevice('Pixel 7');
    await show();
    expect(master().getAttribute('aria-checked')).toBe('false');
    expect(level().disabled).toBe(true);
    expect(level().value).toBe('off');
    expect(screen.getByTestId('remote-hint').textContent).toBe(
      'Schalte oben „Fernsteuerung erlauben“ ein, um einem Gerät etwas zu erlauben.',
    );
    expect([...level().options].map((o) => o.textContent)).toEqual([
      'Nichts',
      'Medien und Lautstärke',
      'Medien, Maus und Tastatur',
    ]);
  });

  it('switching on with no grant asks nobody; allowing a device is asked at the PC', async () => {
    fake.parts.hooks.addDevice('Pixel 7');
    await show();
    fireEvent.click(master());
    await flush();
    expect(master().getAttribute('aria-checked')).toBe('true');
    expect(fake.parts.hooks.asked()).toBe(0);
    expect(screen.getByTestId('remote-hint').textContent).toContain('fragt Windows');

    fireEvent.change(level(), { target: { value: 'media' } });
    await flush();
    expect(fake.parts.hooks.asked()).toBe(1);
    expect(level().value).toBe('media');
    // a narrowing is immediate
    fireEvent.change(level(), { target: { value: 'off' } });
    await flush();
    expect(fake.parts.hooks.asked()).toBe(1);
    expect(level().value).toBe('off');
  });

  it('"Abbrechen" at the PC changes nothing and is not reported as a fault', async () => {
    fake.parts.hooks.addDevice('Pixel 7');
    await show();
    fireEvent.click(master());
    await flush();
    fake.parts.hooks.answer('cancel');
    fireEvent.change(level(), { target: { value: 'full' } });
    await flush();
    expect(level().value).toBe('off');
    expect(screen.queryByTestId('remote-note')).toBeNull();
  });

  it('shows who controls, ends it with one click and keeps the device paused until switched on', async () => {
    const id = fake.parts.hooks.addDevice('Pixel 7');
    await show();
    fireEvent.click(master());
    await flush();
    fireEvent.change(level(), { target: { value: 'media' } });
    await flush();
    expect(screen.queryByTestId('remote-chip')).toBeNull();

    expect(fake.parts.hooks.open(id)).toBe(true);
    await act(async () => {
      await import('@/core/remote/host').then((m) => m.refreshRemoteHost());
    });
    expect(screen.getByTestId('remote-controlling').textContent).toContain(
      'Pixel 7 steuert gerade Medien und Lautstärke',
    );
    expect(screen.getByTestId('remote-controlling').textContent).toContain(
      'Danach bleibt das Gerät pausiert, bis du es hier wieder einschaltest.',
    );
    // the quiet chip in the top bar, only now
    const chip = screen.getByTestId('remote-chip');
    expect(chip.textContent).toBe('Wird ferngesteuert');
    expect(chip.getAttribute('aria-label')).toContain('Pixel 7');
    expect(chip.getAttribute('href')).toBe('/settings/verbindungen#remote');

    fireEvent.click(screen.getByTestId('remote-end'));
    await flush();
    expect(screen.queryByTestId('remote-controlling')).toBeNull();
    expect(screen.queryByTestId('remote-chip')).toBeNull();
    expect(screen.getByTestId('remote-note').textContent).toBe('Beendet. Pixel 7 ist pausiert.');
    expect(screen.getByTestId('remote-device').textContent).toContain('Pausiert');
    expect(fake.parts.hooks.open(id)).toBe(false);

    // switching it on again is a widening: asked at the PC
    const before = fake.parts.hooks.asked();
    fireEvent.click(screen.getByTestId('remote-resume'));
    await flush();
    expect(fake.parts.hooks.asked()).toBe(before + 1);
    expect(screen.queryByTestId('remote-resume')).toBeNull();
    expect(fake.parts.hooks.open(id)).toBe(true);
  });

  it('refuses to widen while mouse and keyboard are controlled, with a calm sentence', async () => {
    const a = fake.parts.hooks.addDevice('Pixel 7');
    fake.parts.hooks.addDevice('Tablet');
    await show();
    fireEvent.click(master());
    await flush();
    const selects = () => screen.getAllByTestId('remote-level') as HTMLSelectElement[];
    fireEvent.change(selects()[0]!, { target: { value: 'full' } });
    await flush();
    expect(fake.parts.hooks.open(a, 'full')).toBe(true);
    const asked = fake.parts.hooks.asked();
    fireEvent.change(selects()[1]!, { target: { value: 'media' } });
    await flush();
    expect(fake.parts.hooks.asked()).toBe(asked);
    expect(selects()[1]!.value).toBe('off');
    expect(screen.getByTestId('remote-note').textContent).toContain(
      'solange ein Gerät Maus und Tastatur steuert',
    );
  });

  it('"Am Handy entsperren" sits under "Erweitert", on by default; switching it off is asked', async () => {
    fake.parts.hooks.addDevice('Pixel 7');
    await show();
    fireEvent.click(master());
    await flush();
    const unlock = screen.getByRole('switch', { name: 'Pixel 7: Am Handy entsperren' });
    expect(unlock.getAttribute('aria-checked')).toBe('true');
    expect(unlock.closest('details')).not.toBeNull();
    fireEvent.click(unlock);
    await flush();
    expect(fake.parts.hooks.asked()).toBe(1);
    expect(
      screen
        .getByRole('switch', { name: 'Pixel 7: Am Handy entsperren' })
        .getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('switching off needs no question and ends the session', async () => {
    const id = fake.parts.hooks.addDevice('Pixel 7');
    await show();
    fireEvent.click(master());
    await flush();
    fireEvent.change(level(), { target: { value: 'media' } });
    await flush();
    fake.parts.hooks.open(id);
    const asked = fake.parts.hooks.asked();
    fireEvent.click(master());
    await flush();
    expect(fake.parts.hooks.asked()).toBe(asked);
    expect(master().getAttribute('aria-checked')).toBe('false');
    expect(fake.parts.hooks.state().controller).toBeNull();
  });
});

describe('RemoteChip', () => {
  it('is not there at all while nobody controls, and polls nothing without the hub', async () => {
    const status = vi.spyOn(fake.parts.host, 'status');
    render(
      <MemoryRouter>
        <RemoteChip />
      </MemoryRouter>,
    );
    await flush();
    expect(screen.queryByTestId('remote-chip')).toBeNull();
    expect(status).not.toHaveBeenCalled();
  });

  it('reads the state once the PC is the home-network hub', async () => {
    const id = fake.parts.hooks.addDevice('Pixel 7');
    await fake.parts.host.setEnabled(true);
    await fake.parts.host.setDevice(id, { level: 'media', paused: false, unlock: true });
    fake.parts.hooks.open(id);
    useSyncStatus.getState().set({ phase: 'idle', via: 'lanHub', encrypted: true });
    render(
      <MemoryRouter>
        <RemoteChip />
      </MemoryRouter>,
    );
    await flush();
    expect(screen.getByTestId('remote-chip').textContent).toBe('Wird ferngesteuert');
  });
});
