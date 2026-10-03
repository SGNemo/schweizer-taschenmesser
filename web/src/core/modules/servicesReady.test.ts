import { afterEach, describe, expect, it } from 'vitest';
import { setServicesWaiter, whenServicesSettled } from './servicesReady';

afterEach(() => setServicesWaiter(null));

describe('whenServicesSettled', () => {
  it('resolves at once when no services are hosted', async () => {
    await expect(whenServicesSettled()).resolves.toBeUndefined();
  });

  it('waits for the hosted services', async () => {
    let release!: () => void;
    const hosted = new Promise<void>((resolve) => (release = resolve));
    setServicesWaiter(() => hosted);
    let done = false;
    void whenServicesSettled().then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    release();
    await hosted;
    await Promise.resolve();
    expect(done).toBe(true);
  });

  it('passes the fresh flag on to the host', async () => {
    const seen: unknown[] = [];
    setServicesWaiter(async (opts) => void seen.push(opts));
    await whenServicesSettled({ fresh: true });
    await whenServicesSettled();
    expect(seen).toEqual([{ fresh: true }, undefined]);
  });

  it('stops waiting once the host is cleared', async () => {
    setServicesWaiter(() => new Promise<void>(() => undefined));
    setServicesWaiter(null);
    await expect(whenServicesSettled()).resolves.toBeUndefined();
  });
});
