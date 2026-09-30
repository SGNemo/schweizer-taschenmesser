import { describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn(async (_cmd: string): Promise<unknown> => null));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { createShare } from './share';

describe('share service', () => {
  it('is inert outside Android', async () => {
    const s = createShare(false);
    expect(s.supported).toBe(false);
    expect(await s.takePending()).toBeUndefined();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('returns a pending share once and nothing when there is none', async () => {
    const s = createShare(true);
    invoke.mockResolvedValueOnce({ title: 'Weg', text: 'https://wandern.example/weg' });
    expect(await s.takePending()).toEqual({ title: 'Weg', text: 'https://wandern.example/weg' });
    expect(invoke).toHaveBeenCalledWith('plugin:share-intent|take_pending');
    invoke.mockResolvedValueOnce(null);
    expect(await s.takePending()).toBeUndefined();
  });
});
