// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { identify } from '../agent';
import { clearTileCache, loadTile } from '../tiles';

const as = (isNative: boolean) =>
  setPlatform({ ...createWebPlatform(), isNative } as PlatformService);

beforeEach(() => {
  URL.createObjectURL = () => 'blob:t';
  URL.revokeObjectURL = () => undefined;
  clearTileCache();
});
afterEach(() => setPlatform(undefined));

describe('identify', () => {
  it('the native shell names the app (OpenStreetMap asks for it); a browser sends nothing extra', () => {
    as(true);
    expect(identify().headers?.['User-Agent']).toMatch(/^Nemo \(https:\/\/github\.com\//);
    as(false);
    expect(identify()).toEqual({});
  });

  it('a tile request carries it only natively, and a refused tile reports its status', async () => {
    as(true);
    const f = vi.fn(async () => new Response('no', { status: 403 })) as unknown as typeof fetch;
    const r = await loadTile('https://t.test/9/9/9.png', f);
    expect(r).toEqual({ error: 'failed', status: 403 });
    const init = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('Nemo');
  });
});
