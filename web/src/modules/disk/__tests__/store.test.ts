import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScanSummary } from '@/core/platform/disk';

/** A native side whose `dropScan` is slow, like the real IPC call. */
const calls: string[] = [];
let nextId = 0;
const finish: Array<(s: ScanSummary) => void> = [];
const disk = {
  startScan: vi.fn(async (root: string) => {
    calls.push(`start ${root}`);
    const scanId = ++nextId;
    return {
      scanId,
      result: new Promise<ScanSummary>((resolve) => finish.push(resolve)),
    };
  }),
  dropScan: vi.fn(async (id: number) => {
    calls.push(`drop ${id}`);
    await new Promise((r) => setTimeout(r, 50));
  }),
  cancelScan: vi.fn(async () => undefined),
  pauseScan: vi.fn(async () => undefined),
};
vi.mock('@/core/platform', () => ({ getPlatform: () => ({ disk }) }));

const { useDiskStore } = await import('../store');

const summary = (scanId: number, root: string) =>
  ({ scanId, root, rootNode: { id: 0 }, cancelled: false }) as unknown as ScanSummary;

describe('scan session', () => {
  beforeEach(() => {
    calls.length = 0;
    finish.length = 0;
    useDiskStore.setState({ phase: 'idle', root: null, scanId: null, summary: null });
  });

  it('a second scan starts at once, even while the first one is still being dropped', async () => {
    const store = useDiskStore.getState();
    void store.start('C:\\');
    await vi.waitFor(() => expect(useDiskStore.getState().scanId).toBe(nextId));
    const first = nextId;
    finish[0]!(summary(first, 'C:\\'));
    await vi.waitFor(() => expect(useDiskStore.getState().phase).toBe('done'));

    // Scan another drive: the page must see "scanning" right away (it redirects on "idle").
    void useDiskStore.getState().start('D:\\');
    expect(useDiskStore.getState().phase).toBe('scanning');
    expect(useDiskStore.getState().root).toBe('D:\\');
    expect(useDiskStore.getState().summary).toBeNull();
    await vi.waitFor(() => expect(useDiskStore.getState().scanId).toBe(first + 1));
    expect(calls).toContain(`drop ${first}`);

    finish[1]!(summary(first + 1, 'D:\\'));
    await vi.waitFor(() => expect(useDiskStore.getState().phase).toBe('done'));
    expect(useDiskStore.getState().summary?.root).toBe('D:\\');
  });
});
