import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiskNode, ScanProgress, ScanSummary } from '@/core/platform/disk';
import { setNow } from '@/core/time/now';

/** A native side whose `dropScan` is slow, like the real IPC call. */
const calls: string[] = [];
let nextId = 0;
const finish: Array<(s: ScanSummary) => void> = [];
let report: ((p: ScanProgress) => void) | null = null;
let picture: DiskNode[] = [];
/** When set, `liveScan` answers only after it resolves. */
let liveGate: Promise<void> | null = null;
const disk = {
  startScan: vi.fn(async (root: string, onProgress: (p: ScanProgress) => void) => {
    calls.push(`start ${root}`);
    report = onProgress;
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
  liveScan: vi.fn(async () => {
    await liveGate;
    return picture;
  }),
};
vi.mock('@/core/platform', () => ({ getPlatform: () => ({ disk }) }));

const { useDiskStore } = await import('../store');

const summary = (scanId: number, root: string) =>
  ({ scanId, root, rootNode: { id: 0 }, cancelled: false }) as unknown as ScanSummary;
const progress = (files: number): ScanProgress => ({
  files,
  dirs: 1,
  bytes: files * 10,
  current: '',
});
const node = (id: number, pending = false) => ({ id, pending }) as unknown as DiskNode;

describe('scan session', () => {
  beforeEach(() => {
    calls.length = 0;
    finish.length = 0;
    useDiskStore.setState({
      phase: 'idle',
      root: null,
      scanId: null,
      summary: null,
      progress: null,
      live: [],
    });
    report = null;
    picture = [];
    liveGate = null;
  });
  afterEach(() => setNow());

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

  it('the status line gets a new figure at most once a second', async () => {
    setNow(() => 10_000);
    void useDiskStore.getState().start('C:\\');
    await vi.waitFor(() => expect(report).not.toBeNull());
    report!(progress(100));
    expect(useDiskStore.getState().progress?.files).toBe(100);
    // Rust reports every 100 ms; the second and third report within the same second are skipped.
    setNow(() => 10_400);
    report!(progress(200));
    setNow(() => 10_900);
    report!(progress(300));
    expect(useDiskStore.getState().progress?.files).toBe(100);
    setNow(() => 11_000);
    report!(progress(400));
    expect(useDiskStore.getState().progress?.files).toBe(400);
  });

  it('keeps the live picture of the running scan and drops it when the scan is done or replaced', async () => {
    void useDiskStore.getState().start('C:\\');
    await vi.waitFor(() => expect(useDiskStore.getState().scanId).toBe(nextId));
    picture = [node(0, true), node(1)];
    await useDiskStore.getState().pollLive(123);
    expect(disk.liveScan).toHaveBeenLastCalledWith(nextId, 123);
    expect(useDiskStore.getState().live).toEqual(picture);
    // The same picture again is not set again (nothing to draw).
    const kept = useDiskStore.getState().live;
    picture = [node(0, true), node(1)];
    await useDiskStore.getState().pollLive(123);
    expect(useDiskStore.getState().live).toBe(kept);

    // A picture that arrives after the scan finished is not kept.
    let release!: () => void;
    liveGate = new Promise<void>((r) => (release = r));
    picture = [node(0), node(1), node(2)];
    const slow = useDiskStore.getState().pollLive(0);
    // While that answer is pending, another tick does not ask again.
    disk.liveScan.mockClear();
    await useDiskStore.getState().pollLive(0);
    expect(disk.liveScan).not.toHaveBeenCalled();
    finish.at(-1)!(summary(nextId, 'C:\\'));
    await vi.waitFor(() => expect(useDiskStore.getState().phase).toBe('done'));
    release();
    await slow;
    expect(useDiskStore.getState().live).toEqual([]);

    // Nothing runs: polling is a no-op.
    disk.liveScan.mockClear();
    await useDiskStore.getState().pollLive(0);
    expect(disk.liveScan).not.toHaveBeenCalled();

    // A new scan starts with an empty picture.
    useDiskStore.setState({ live: picture, phase: 'scanning' });
    void useDiskStore.getState().start('D:\\');
    expect(useDiskStore.getState().live).toEqual([]);
  });
});
