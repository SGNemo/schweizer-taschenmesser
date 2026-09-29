import { describe, expect, it, vi } from 'vitest';
import { createEventBus } from './bus';

describe('event bus', () => {
  it('delivers payloads to subscribers and supports unsubscribe', async () => {
    const bus = createEventBus();
    const fn = vi.fn();
    const off = bus.on('module.enabled', fn);
    await bus.emit('module.enabled', { moduleId: 'a' });
    off();
    await bus.emit('module.enabled', { moduleId: 'b' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ moduleId: 'a' });
  });

  it('isolates failing handlers', async () => {
    const bus = createEventBus();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ok = vi.fn();
    bus.on('module.enabled', () => {
      throw new Error('boom');
    });
    bus.on('module.enabled', ok);
    await expect(bus.emit('module.enabled', { moduleId: 'a' })).resolves.toBeUndefined();
    expect(ok).toHaveBeenCalled();
    spy.mockRestore();
  });
});
