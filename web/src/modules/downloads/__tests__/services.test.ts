import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPlatform, setPlatform } from '@/core/platform';
import manifest from '../manifest';
import startDownloadsServices from '../services';

afterEach(() => setPlatform(undefined));

describe('downloads services (DL2)', () => {
  it('switching the module off stops the torrent engine', async () => {
    const stop = vi.fn(async () => {});
    const base = getPlatform();
    setPlatform({ ...base, torrent: { ...base.torrent, supported: true, stop } });
    const off = startDownloadsServices();
    expect(stop).not.toHaveBeenCalled();
    off();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('is wired as the module service', async () => {
    const load = manifest.contributions?.services;
    expect(load).toBeDefined();
    expect((await load!()).default).toBe(startDownloadsServices);
  });
});
