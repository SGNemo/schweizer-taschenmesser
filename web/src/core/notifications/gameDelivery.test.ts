// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { withGameDelivery, type GameDeliveryDeps } from './gameDelivery';
import type { GameSettings } from './gameMode';
import type { NotificationService, ShowNotification } from './service';

const n: ShowNotification = { title: 'Zahnarzt', tag: 'a' };

type Patch = Omit<Partial<GameDeliveryDeps>, 'settings'> & { settings?: Partial<GameSettings> };

function setup(patch: Patch = {}) {
  const show = vi.fn(async (_: ShowNotification) => undefined);
  const scheduleUpcoming = vi.fn(async () => undefined);
  const base: NotificationService = {
    permission: () => 'granted',
    requestPermission: async () => 'granted',
    show,
    scheduleUpcoming,
  };
  const tone = vi.fn(async () => 'native');
  const deps: GameDeliveryDeps = {
    kind: 'desktop',
    detect: async () => true,
    tone,
    ...patch,
    settings: () => ({ mode: 'auto', sound: 'bell', volume: 60, ...patch.settings }),
  };
  return { service: withGameDelivery(base, deps), show, tone, scheduleUpcoming };
}

describe('withGameDelivery', () => {
  it('shows without the system sound and adds the app tone while a game runs', async () => {
    const { service, show, tone } = setup();
    await service.show(n);
    expect(show).toHaveBeenCalledWith({ ...n, quiet: true });
    expect(tone).toHaveBeenCalledWith('bell', 60);
  });

  it('leaves everything as it is when no game runs: no tone, no change', async () => {
    const { service, show, tone } = setup({ detect: async () => false });
    await service.show(n);
    expect(show).toHaveBeenCalledWith(n);
    expect(tone).not.toHaveBeenCalled();
  });

  it('plays no tone when the mode is off, even if a game runs', async () => {
    const { service, show, tone } = setup({ settings: { mode: 'off' } });
    await service.show(n);
    expect(show).toHaveBeenCalledWith(n);
    expect(tone).not.toHaveBeenCalled();
  });

  it('keeps a muted ("Stumm") reminder silent: no tone', async () => {
    const { service, show, tone } = setup();
    await service.show({ ...n, quiet: true });
    expect(show).toHaveBeenCalledWith({ ...n, quiet: true });
    expect(tone).not.toHaveBeenCalled();
  });

  it('works as the manual switch too: always means the tone, without asking the detection', async () => {
    const detect = vi.fn(async () => false);
    const { service, tone } = setup({ settings: { mode: 'on' }, detect });
    await service.show(n);
    expect(tone).toHaveBeenCalledTimes(1);
    expect(detect).not.toHaveBeenCalled();
  });

  it('on Android and in the browser only uses the quiet channel, no tone', async () => {
    for (const kind of ['android', 'web'] as const) {
      const { service, show, tone } = setup({ kind, settings: { mode: 'on' }, detect: undefined });
      await service.show(n);
      expect(show).toHaveBeenCalledWith({ ...n, quiet: true });
      expect(tone).not.toHaveBeenCalled();
    }
  });

  it('keeps the other service methods, so the Android schedule still works', async () => {
    const { service, scheduleUpcoming } = setup();
    await service.scheduleUpcoming?.([]);
    expect(scheduleUpcoming).toHaveBeenCalled();
    expect(service.permission()).toBe('granted');
  });
});
