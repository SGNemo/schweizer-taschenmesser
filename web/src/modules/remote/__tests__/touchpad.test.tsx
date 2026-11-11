// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeRemoteParts } from '@/core/platform/fakeRemote';
import type { RemoteView } from '@/core/remote/session';
import { useSyncStatus } from '@/core/sync/status';

const fake = vi.hoisted(() => ({
  parts: undefined as unknown as ReturnType<typeof createFakeRemoteParts>,
  keepAwake: vi.fn(async (_on: boolean) => undefined),
  prefs: undefined as undefined | Record<string, unknown>,
  setPrefs: vi.fn(),
}));

vi.mock('@/core/platform', () => ({
  getPlatform: () => ({
    kind: 'android',
    isNative: true,
    remote: { ...fake.parts.remote, supported: true },
    display: { setKeepAwake: fake.keepAwake },
  }),
}));
vi.mock('@/core/sync/service', () => ({ syncNow: vi.fn(async () => undefined) }));
vi.mock('@/core/settings/settings', () => ({ useSettings: () => [fake.prefs, fake.setPrefs] }));

import RemotePage from '../routes/RemotePage';
import { remoteSession } from '../session';
import { describePad } from '../view';

const wait = (ms: number) => act(async () => new Promise((r) => setTimeout(r, ms)));
/** Waits until `ready()` holds (the session opens at most once a second). */
async function until(ready: () => boolean) {
  for (let i = 0; i < 600 && !ready(); i++) await wait(10);
  await wait(0);
}
async function showPad() {
  render(
    <MemoryRouter>
      <RemotePage />
    </MemoryRouter>,
  );
  await until(() => fake.parts.hooks.opens() > 0);
  fireEvent.click(screen.getByRole('button', { name: 'Touchpad' }));
  await wait(0);
}
const state = () => screen.getByTestId('remote-state').textContent;
const surface = () => screen.getByTestId('remote-surface');
/** jsdom has no PointerEvent with ids: one finger, by mouse-shaped events carrying an id. */
function finger(type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number, id = 1) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: id });
  fireEvent(surface(), event);
}

beforeEach(async () => {
  await remoteSession.close();
  fake.parts = createFakeRemoteParts();
  fake.prefs = { haptics: false, keepAwake: false, padSpeed: 'normal', padLegendSeen: true };
  fake.setPrefs.mockClear();
  fake.keepAwake.mockClear();
  useSyncStatus.getState().set({ phase: 'idle', via: 'lanClient', error: undefined });
});

describe('the touchpad’s line', () => {
  const pc = { volume: 42, mute: false, playing: false, locked: false };
  const connected: RemoteView = { kind: 'connected', pc };
  it('says what stands between this phone and the pad, with one step', () => {
    expect(describePad(connected, { kind: 'not-granted' }, undefined)).toMatchObject({
      text: 'Maus und Tastatur sind am PC für dieses Handy aus.',
      step: 'media',
      live: false,
    });
    expect(describePad(connected, { kind: 'unlock' }, undefined)).toMatchObject({
      text: 'Maus und Tastatur brauchen einmal dein Entsperren.',
      step: 'unlock',
      live: false,
    });
    expect(describePad(connected, { kind: 'unavailable' }, undefined).step).toBe('media');
    expect(describePad(connected, { kind: 'locked' }, undefined)).toMatchObject({
      text: 'PC ist gesperrt. Medien und Lautstärke gehen weiter.',
      step: 'media',
    });
    expect(describePad(connected, { kind: 'ready', noLock: false }, undefined)).toMatchObject({
      text: 'Dein PC · Lautstärke 42 %',
      live: true,
    });
    // a fact, nothing is blocked
    expect(describePad(connected, { kind: 'ready', noLock: true }, undefined)).toMatchObject({
      text: 'Dieses Handy hat keine Bildschirmsperre. Maus und Tastatur gehen ohne Entsperren.',
      live: true,
    });
    // locked meanwhile: the session stays, the pad is still
    const locked: RemoteView = { kind: 'connected', pc: { ...pc, locked: true } };
    expect(describePad(locked, { kind: 'ready', noLock: false }, undefined).live).toBe(false);
    // the session's own states come first
    expect(describePad({ kind: 'unreachable' }, { kind: 'off' }, undefined)).toMatchObject({
      step: 'retry',
      live: false,
    });
  });
});

describe('page Touchpad', () => {
  it('a phone granted media only reads its sentence at once and gets back to Medien', async () => {
    await showPad();
    expect(state()).toContain('Maus und Tastatur sind am PC für dieses Handy aus.');
    expect(fake.parts.hooks.opens()).toBe(1);
    expect(surface().getAttribute('aria-disabled')).toBe('true');
    expect((screen.getByTestId('remote-strip-left') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('remote-to-media'));
    expect(screen.getByTestId('remote-play-pause')).toBeTruthy();
  });

  it('opens the mouse level by being used; sliding moves, a tap clicks, the strip holds', async () => {
    fake.parts.hooks.setGrant('full');
    await showPad();
    await until(() => fake.parts.hooks.level() === 'full');
    expect(state()).toBe('Dein PC · Lautstärke 42 %');
    expect(surface().getAttribute('aria-disabled')).toBe('false');
    // the screen stays on, whatever the switch says
    expect(fake.keepAwake).toHaveBeenCalledWith(true);

    finger('pointerdown', 100, 100);
    finger('pointermove', 130, 110);
    finger('pointerup', 130, 110);
    await wait(0);
    expect(fake.parts.hooks.pointed()).toEqual([{ kind: 'move', dx: 30, dy: 10 }]);

    finger('pointerdown', 50, 50);
    finger('pointerup', 50, 50);
    await wait(0);
    expect(fake.parts.hooks.sent()).toEqual(['left-down', 'left-up']);

    // dragging: "Links" is down exactly as long as the strip is held
    const left = screen.getByTestId('remote-strip-left');
    fireEvent.pointerDown(left);
    finger('pointerdown', 100, 100, 2);
    finger('pointermove', 100, 140, 2);
    fireEvent.pointerUp(left);
    await wait(0);
    expect(fake.parts.hooks.sent().slice(2)).toEqual(['left-down', 'left-up']);
    expect(fake.parts.hooks.pointed().at(-1)).toEqual({ kind: 'move', dx: 0, dy: 40 });
    // without a pointer (screen reader) the strip is one whole click
    fireEvent.click(screen.getByTestId('remote-strip-right'), { detail: 0 });
    await wait(0);
    expect(fake.parts.hooks.sent().slice(4)).toEqual(['right-down', 'right-up']);
  });

  it('a dismissed unlock leaves the pad still and asks again only on "Entsperren"', async () => {
    fake.parts.hooks.setGrant('full', true);
    fake.parts.hooks.setUnlock('cancel');
    await showPad();
    await until(() => fake.parts.hooks.unlocks() === 1);
    expect(state()).toContain('Maus und Tastatur brauchen einmal dein Entsperren.');
    finger('pointerdown', 10, 10);
    finger('pointerup', 10, 10);
    await wait(1200);
    expect(fake.parts.hooks.unlocks()).toBe(1);
    fake.parts.hooks.setUnlock('ok');
    fireEvent.click(screen.getByTestId('remote-unlock'));
    await until(() => fake.parts.hooks.level() === 'full');
    expect(fake.parts.hooks.unlocks()).toBe(2);
  });

  it('shows the legend once the pad can be used; closing it is remembered, the menu brings it back', async () => {
    fake.prefs = { haptics: false, keepAwake: false, padSpeed: 'normal', padLegendSeen: false };
    // with a sentence to act on the legend waits: it must not push the pad away
    await showPad();
    expect(state()).toContain('Maus und Tastatur sind am PC für dieses Handy aus.');
    expect(screen.queryByTestId('remote-legend')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Medien' }));
    fake.parts.hooks.setGrant('full');
    fireEvent.click(screen.getByRole('button', { name: 'Touchpad' }));
    await until(() => fake.parts.hooks.level() === 'full');
    expect(screen.getByTestId('remote-legend').textContent).toContain('Wischen bewegt den Zeiger.');
    fireEvent.click(screen.getByTestId('remote-legend-close'));
    expect(fake.setPrefs).toHaveBeenCalledWith({ padLegendSeen: true });

    fake.prefs = { ...fake.prefs, padLegendSeen: true };
    fireEvent.click(screen.getByRole('button', { name: 'Weitere Aktionen' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'So geht das Touchpad' }));
    expect(screen.getByTestId('remote-legend')).toBeTruthy();
  });

  it('after the PC ended an idle session a touch connects again and the pad comes back', async () => {
    fake.parts.hooks.setGrant('full');
    await showPad();
    await until(() => fake.parts.hooks.level() === 'full');
    await act(async () => fake.parts.hooks.close());
    expect(fake.parts.hooks.isOpen()).toBe(false);
    // the pad waits for a touch: it does not look switched off
    expect(surface().getAttribute('aria-disabled')).toBe('false');
    finger('pointerdown', 20, 20);
    finger('pointerup', 20, 20);
    await until(() => fake.parts.hooks.level() === 'full');
    expect(surface().getAttribute('aria-disabled')).toBe('false');
    finger('pointerdown', 100, 100);
    finger('pointermove', 120, 100);
    await wait(0);
    expect(fake.parts.hooks.pointed().at(-1)).toEqual({ kind: 'move', dx: 20, dy: 0 });
  });

  it('the PC is locked while "Links" is held: the button is let go at once', async () => {
    fake.parts.hooks.setGrant('full');
    await showPad();
    await until(() => fake.parts.hooks.level() === 'full');
    fireEvent.pointerDown(screen.getByTestId('remote-strip-left'));
    await wait(0);
    await act(async () => fake.parts.hooks.setState({ locked: true }));
    await wait(0);
    expect(fake.parts.hooks.sent()).toEqual(['left-down', 'left-up']);
    expect(state()).toContain('PC ist gesperrt.');
  });
});
