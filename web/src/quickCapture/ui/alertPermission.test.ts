// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAlertPermission } from './alertPermission';

const service = (initial: string, answer = 'granted') => {
  const requestPermission = vi.fn(async () => answer as never);
  return { permission: () => initial as never, requestPermission };
};

beforeEach(() => localStorage.clear());

describe('ensureAlertPermission (C01)', () => {
  it('asks when the first reminder is saved and nothing was decided yet', async () => {
    const s = service('default');
    expect(await ensureAlertPermission(['reminder'], s)).toEqual({ justGranted: true });
    expect(s.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('never asks for other entries', async () => {
    const s = service('default');
    expect(await ensureAlertPermission(['todo', 'event', undefined], s)).toEqual({});
    expect(s.requestPermission).not.toHaveBeenCalled();
  });

  it('does not ask after a no, and reports it', async () => {
    const s = service('denied');
    expect(await ensureAlertPermission(['todo', 'reminder'], s)).toEqual({ off: 'denied' });
    expect(s.requestPermission).not.toHaveBeenCalled();
  });

  it('asks only once per device, also after a dismissed prompt or a restart', async () => {
    const first = service('default', 'default');
    expect(await ensureAlertPermission(['reminder'], first)).toEqual({ off: 'default' });
    // Next session: Android reports "default" again even after a "no".
    const next = service('default', 'denied');
    expect(await ensureAlertPermission(['reminder'], next)).toEqual({ off: 'default' });
    expect(next.requestPermission).not.toHaveBeenCalled();
  });

  it('survives a throwing prompt', async () => {
    const broken = {
      permission: () => 'default' as const,
      requestPermission: vi.fn(async () => {
        throw new Error('no prompt');
      }),
    };
    expect(await ensureAlertPermission(['reminder'], broken)).toEqual({ off: 'default' });
  });

  it('stays quiet where alerts are on or the platform cannot notify', async () => {
    expect(await ensureAlertPermission(['reminder'], service('granted'))).toEqual({});
    expect(await ensureAlertPermission(['reminder'], service('unsupported'))).toEqual({});
  });
});
