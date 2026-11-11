// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRemoteHostParts } from '@/core/platform/fakeRemoteHost';
import { refreshRemoteHost, useRemoteHost, WATCH_MS } from '@/core/remote/host';
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
const notice = () =>
  screen.getByRole('switch', { name: 'Melden, wenn ein Gerät Maus und Tastatur steuert' });
const UNLOCK = 'Vor Maus und Tastatur am Handy entsperren';

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
    // the level is never offered without the switch of its notification, which is on
    expect(notice().getAttribute('aria-checked')).toBe('true');
    // the phone's unlock belongs to mouse and keyboard only
    expect(screen.queryByRole('switch', { name: UNLOCK })).toBeNull();
    expect(screen.queryByText('Erweitert')).toBeNull();
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

  it('mouse and keyboard: asked at the PC, with the phone’s unlock on; dropping the unlock is asked too', async () => {
    fake.parts.hooks.addDevice('Pixel 7');
    await show();
    fireEvent.click(master());
    await flush();
    fireEvent.change(level(), { target: { value: 'full' } });
    await flush();
    expect(fake.parts.hooks.asked()).toBe(1);
    expect(level().value).toBe('full');
    const unlock = () => screen.getByRole('switch', { name: UNLOCK });
    expect(unlock().getAttribute('aria-checked')).toBe('true');
    // one protection less: a question, and "Abbrechen" leaves it on
    fake.parts.hooks.answer('cancel');
    fireEvent.click(unlock());
    await flush();
    expect(unlock().getAttribute('aria-checked')).toBe('true');
    fake.parts.hooks.answer('allow');
    fireEvent.click(unlock());
    await flush();
    expect(fake.parts.hooks.asked()).toBe(3);
    expect(unlock().getAttribute('aria-checked')).toBe('false');
    // back on is a narrowing: nobody is asked
    fireEvent.click(unlock());
    await flush();
    expect(fake.parts.hooks.asked()).toBe(3);
    expect(unlock().getAttribute('aria-checked')).toBe('true');
  });

  it('the notification: off is asked at the PC, on is not, and never while mouse and keyboard are controlled', async () => {
    const id = fake.parts.hooks.addDevice('Pixel 7');
    await show();
    expect(screen.getByText(/höchstens einmal in 30 Minuten je Gerät/)).toBeTruthy();
    fake.parts.hooks.answer('cancel');
    fireEvent.click(notice());
    await flush();
    expect(notice().getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByTestId('remote-note')).toBeNull();
    fake.parts.hooks.answer('allow');
    fireEvent.click(notice());
    await flush();
    expect(fake.parts.hooks.asked()).toBe(2);
    expect(notice().getAttribute('aria-checked')).toBe('false');
    fireEvent.click(notice());
    await flush();
    expect(fake.parts.hooks.asked()).toBe(2);
    expect(notice().getAttribute('aria-checked')).toBe('true');

    // a device controls mouse and keyboard: the notification cannot be switched off now
    fireEvent.click(master());
    await flush();
    await fake.parts.host.setDevice(id, { level: 'full', paused: false, unlock: true });
    expect(fake.parts.hooks.open(id, 'full')).toBe(true);
    fireEvent.click(notice());
    await flush();
    expect(notice().getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('remote-note').textContent).toContain(
      'solange ein Gerät Maus und Tastatur steuert',
    );
  });

  it('"Abbrechen" at the PC changes nothing and is not reported as a fault', async () => {
    fake.parts.hooks.addDevice('Pixel 7');
    await show();
    fireEvent.click(master());
    await flush();
    fake.parts.hooks.answer('cancel');
    fireEvent.change(level(), { target: { value: 'media' } });
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
      await refreshRemoteHost();
    });
    expect(screen.getByTestId('remote-controlling').textContent).toContain(
      'Pixel 7 steuert gerade Medien und Lautstärke',
    );
    expect(screen.getByTestId('remote-controlling').textContent).toContain(
      'Beenden pausiert Pixel 7, bis du es hier wieder einschaltest.',
    );
    // the quiet chip in the top bar, only now
    const chip = screen.getByTestId('remote-chip');
    expect(chip.textContent).toBe('Fernsteuerung: Pixel 7');
    expect(chip.getAttribute('aria-label')).toContain('Pixel 7');
    expect(chip.getAttribute('href')).toBe('/settings/verbindungen#remote');

    fireEvent.click(screen.getByTestId('remote-end'));
    await flush();
    expect(screen.queryByTestId('remote-controlling')).toBeNull();
    expect(screen.queryByTestId('remote-chip')).toBeNull();
    expect(screen.getByTestId('remote-note').textContent).toBe('Beendet. Pixel 7 ist pausiert.');
    expect(screen.getByTestId('remote-device').textContent).toContain('Pausiert');
    // while paused there is one step only: no choice next to "Wieder einschalten"
    expect(screen.queryByTestId('remote-level')).toBeNull();
    expect(fake.parts.hooks.open(id)).toBe(false);

    // switching it on again is a widening: asked at the PC
    const before = fake.parts.hooks.asked();
    fireEvent.click(screen.getByTestId('remote-resume'));
    await flush();
    expect(fake.parts.hooks.asked()).toBe(before + 1);
    expect(screen.queryByTestId('remote-resume')).toBeNull();
    expect(level().value).toBe('media');
    expect(fake.parts.hooks.open(id)).toBe(true);
  });

  it('refuses to widen while mouse and keyboard are controlled, with a calm sentence', async () => {
    const a = fake.parts.hooks.addDevice('Pixel 7');
    fake.parts.hooks.addDevice('Tablet');
    await fake.parts.host.setEnabled(true);
    // a grant from a later package (not choosable here yet), and its session
    await fake.parts.host.setDevice(a, { level: 'full', paused: false, unlock: true });
    expect(fake.parts.hooks.open(a, 'full')).toBe(true);
    await show();
    const selects = () => screen.getAllByTestId('remote-level') as HTMLSelectElement[];
    // a level set elsewhere is shown as it is
    expect(selects()[0]!.value).toBe('full');
    const asked = fake.parts.hooks.asked();
    fireEvent.change(selects()[1]!, { target: { value: 'media' } });
    await flush();
    expect(fake.parts.hooks.asked()).toBe(asked);
    expect(selects()[1]!.value).toBe('off');
    expect(screen.getByTestId('remote-note').textContent).toContain(
      'solange ein Gerät Maus und Tastatur steuert',
    );
  });

  it('lowering a level never lifts a pause that came from the tray a moment ago', async () => {
    const id = fake.parts.hooks.addDevice('Pixel 7');
    await show();
    fireEvent.click(master());
    await flush();
    fireEvent.change(level(), { target: { value: 'media' } });
    await flush();
    const asked = fake.parts.hooks.asked();
    // "Fernsteuerung beenden" in the tray: the page still shows the old reading
    fake.parts.hooks.open(id);
    await fake.parts.host.end();
    fireEvent.change(level(), { target: { value: 'off' } });
    await flush();
    expect(fake.parts.hooks.asked()).toBe(asked);
    const state = fake.parts.hooks.state().devices[0]!;
    expect([state.level, state.paused]).toEqual(['off', true]);
  });

  it.each([
    ['busy', 'Ein Fenster von Nemo wartet noch auf deine Antwort. Beantworte es zuerst.'],
    ['changed', 'In der Zwischenzeit hat sich die Freigabe geändert. Wähle noch einmal.'],
    ['failed', 'Das ließ sich nicht speichern. Versuche es noch einmal.'],
    ['toString', 'Das ließ sich nicht speichern. Versuche es noch einmal.'],
  ])('says what to do after the PC refused with "%s"', async (code, text) => {
    fake.parts.hooks.addDevice('Pixel 7');
    await show();
    fireEvent.click(master());
    await flush();
    fake.parts.hooks.failNext(code);
    fireEvent.change(level(), { target: { value: 'media' } });
    await flush();
    expect(screen.getByTestId('remote-note').textContent).toBe(text);
    expect(level().value).toBe('off');
  });

  it('a device unpaired in the meantime is reported, not changed', async () => {
    const id = fake.parts.hooks.addDevice('Pixel 7');
    await show();
    fireEvent.click(master());
    await flush();
    fake.parts.hooks.removeDevice(id);
    fireEvent.change(level(), { target: { value: 'media' } });
    await flush();
    expect(screen.getByTestId('remote-note').textContent).toBe(
      'Dieses Gerät ist nicht mehr gekoppelt.',
    );
    expect(screen.queryByTestId('remote-device')).toBeNull();
  });

  it('a stored permission is announced before the switch asks Windows', async () => {
    const id = fake.parts.hooks.addDevice('Pixel 7');
    await fake.parts.host.setEnabled(true);
    await fake.parts.host.setDevice(id, { level: 'media', paused: false, unlock: true });
    await fake.parts.host.setEnabled(false);
    const asked = fake.parts.hooks.asked();
    await show();
    expect(master().parentElement?.parentElement?.textContent).toContain('fragt Windows');
    fireEvent.click(master());
    await flush();
    expect(fake.parts.hooks.asked()).toBe(asked + 1);
  });

  it('a reading that fails is not reported as "unpaired"; without the hub its sentence takes over', async () => {
    fake.parts.hooks.addDevice('Pixel 7');
    await show();
    fireEvent.click(master());
    await flush();
    fake.parts.hooks.setRunning(false);
    fireEvent.change(level(), { target: { value: 'media' } });
    await flush();
    expect(screen.queryByText('Dieses Gerät ist nicht mehr gekoppelt.')).toBeNull();
    expect(screen.getByTestId('remote-need-hub')).toBeTruthy();
    fake.parts.hooks.setRunning(true);
    expect(fake.parts.hooks.state().devices[0]!.level).toBe('off');
  });

  it('an answer that comes after the page was left does not fill the shared state again', async () => {
    const id = fake.parts.hooks.addDevice('Pixel 7');
    const view = render(
      <MemoryRouter>
        <RemoteHostSection />
      </MemoryRouter>,
    );
    await flush();
    fireEvent.click(master());
    await flush();
    // the "Windows dialog" stays open …
    let answer: () => void = () => undefined;
    const real = fake.parts.host.setDevice.bind(fake.parts.host);
    vi.spyOn(fake.parts.host, 'setDevice').mockImplementationOnce(async (dev, grant) => {
      await new Promise<void>((r) => (answer = r));
      return real(dev, grant);
    });
    fireEvent.change(level(), { target: { value: 'media' } });
    await flush();
    // … while the person leaves the settings, then answers
    view.unmount();
    expect(useRemoteHost.getState()).toEqual({ status: undefined, off: true });
    answer();
    await flush();
    expect(fake.parts.hooks.state().devices.find((d) => d.id === id)?.level).toBe('media');
    expect(useRemoteHost.getState()).toEqual({ status: undefined, off: true });
  });

  it('a controller without a name is still named in the banner and the chip', async () => {
    const id = fake.parts.hooks.addDevice('');
    await fake.parts.host.setEnabled(true);
    await fake.parts.host.setDevice(id, { level: 'media', paused: false, unlock: true });
    fake.parts.hooks.open(id);
    await show();
    expect(screen.getByTestId('remote-controlling').textContent).toContain(
      'Gerät ohne Namen (dev1) steuert gerade',
    );
    expect(screen.getByTestId('remote-chip').textContent).toBe(
      'Fernsteuerung: Gerät ohne Namen (dev1)',
    );
  });

  it('a device without a name gets a label', async () => {
    fake.parts.hooks.addDevice('');
    await show();
    expect(screen.getByTestId('remote-device').textContent).toContain('Gerät ohne Namen (dev1)');
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
    expect(screen.getByTestId('remote-chip').textContent).toBe('Fernsteuerung: Pixel 7');
  });
});

describe('the shared reading (core/remote/host)', () => {
  afterEach(() => vi.useRealTimers());

  it('one timer for chip and section, none left when both are gone, and the store is emptied', async () => {
    vi.useFakeTimers();
    const status = vi.spyOn(fake.parts.host, 'status');
    useSyncStatus.getState().set({ phase: 'idle', via: 'lanHub', encrypted: true });
    const view = render(
      <MemoryRouter>
        <RemoteChip />
        <RemoteHostSection />
      </MemoryRouter>,
    );
    await act(async () => vi.advanceTimersByTimeAsync(0));
    const first = status.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(WATCH_MS));
    expect(status.mock.calls.length).toBe(first + 1);
    // the hub goes: the chip stops asking, the open section keeps reading – and keeps its state
    useSyncStatus.getState().set({ phase: 'off', via: undefined });
    await act(async () => vi.advanceTimersByTimeAsync(WATCH_MS));
    expect(status.mock.calls.length).toBe(first + 2);
    expect(useRemoteHost.getState().status).toBeDefined();
    view.unmount();
    const after = status.mock.calls.length;
    await vi.advanceTimersByTimeAsync(WATCH_MS * 3);
    expect(status.mock.calls.length).toBe(after);
    expect(useRemoteHost.getState()).toEqual({ status: undefined, off: true });
  });

  it('an answer that arrives after a newer one is dropped', async () => {
    const id = fake.parts.hooks.addDevice('Pixel 7');
    await fake.parts.host.setEnabled(true);
    await fake.parts.host.setDevice(id, { level: 'media', paused: false, unlock: true });
    fake.parts.hooks.open(id);
    const real = fake.parts.host.status.bind(fake.parts.host);
    let release: () => void = () => undefined;
    const slow = vi.spyOn(fake.parts.host, 'status').mockImplementationOnce(async () => {
      const old = await real();
      await new Promise<void>((r) => (release = r));
      return old;
    });
    const stale = refreshRemoteHost();
    await fake.parts.host.end();
    await refreshRemoteHost();
    expect(useRemoteHost.getState().status?.controller).toBeNull();
    release();
    await stale;
    expect(useRemoteHost.getState().status?.controller).toBeNull();
    slow.mockRestore();
  });

  it('a reading that fails no longer vouches for a controller', async () => {
    const id = fake.parts.hooks.addDevice('Pixel 7');
    await fake.parts.host.setEnabled(true);
    await fake.parts.host.setDevice(id, { level: 'media', paused: false, unlock: true });
    fake.parts.hooks.open(id);
    await refreshRemoteHost();
    expect(useRemoteHost.getState().status?.controller?.name).toBe('Pixel 7');
    vi.spyOn(fake.parts.host, 'status').mockRejectedValueOnce(new Error('internal'));
    await refreshRemoteHost();
    expect(useRemoteHost.getState().status?.controller).toBeNull();
    expect(useRemoteHost.getState().off).toBe(false);
  });
});
