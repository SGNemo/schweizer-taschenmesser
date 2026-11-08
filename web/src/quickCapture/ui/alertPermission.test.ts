import { describe, expect, it, vi } from 'vitest';
import { ensureAlertPermission } from './alertPermission';

const service = (initial: string, answer = 'granted') => {
  const requestPermission = vi.fn(async () => answer as never);
  return { permission: () => initial as never, requestPermission };
};

describe('ensureAlertPermission (C01)', () => {
  it('asks once when a reminder is saved and nothing was decided yet', async () => {
    const s = service('default');
    expect(await ensureAlertPermission(['reminder'], s)).toEqual({
      blocked: false,
      justGranted: true,
    });
    expect(s.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('never asks for other entries', async () => {
    const s = service('default');
    expect(await ensureAlertPermission(['todo', 'event', undefined], s)).toEqual({
      blocked: false,
    });
    expect(s.requestPermission).not.toHaveBeenCalled();
  });

  it('does not ask again after a no, and reports it', async () => {
    const s = service('denied');
    expect(await ensureAlertPermission(['todo', 'reminder'], s)).toEqual({ blocked: true });
    expect(s.requestPermission).not.toHaveBeenCalled();
  });

  it('reports a dismissed prompt and survives a throwing one', async () => {
    expect(await ensureAlertPermission(['reminder'], service('default', 'default'))).toEqual({
      blocked: true,
    });
    const broken = {
      permission: () => 'default' as const,
      requestPermission: vi.fn(async () => {
        throw new Error('no prompt');
      }),
    };
    expect(await ensureAlertPermission(['reminder'], broken)).toEqual({ blocked: true });
  });

  it('stays quiet where the platform cannot notify at all', async () => {
    expect(await ensureAlertPermission(['reminder'], service('unsupported'))).toEqual({
      blocked: false,
    });
  });

  it('reports nothing new when alerts were already allowed', async () => {
    const s = service('granted');
    expect(await ensureAlertPermission(['reminder'], s)).toEqual({ blocked: false });
    expect(s.requestPermission).not.toHaveBeenCalled();
  });
});
