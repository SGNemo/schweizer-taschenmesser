import { Channel, invoke } from '@tauri-apps/api/core';
import type {
  DiskNode,
  DiskQuery,
  DiskService,
  DriveInfo,
  ScanHandle,
  ScanProgress,
  ScanSummary,
} from '../disk';

type ScanEvent =
  | ({ event: 'progress' } & ScanProgress)
  | ({ event: 'done' } & ScanSummary)
  | { event: 'failed'; reason: string };

const unsupported = (): Promise<never> => Promise.reject(new Error('unsupported'));

/** Bridge to `src-tauri/src/disk.rs`. Errors are the short codes of the Rust side. */
export function createDisk(supported: boolean): DiskService {
  if (!supported) {
    return {
      supported: false,
      listDrives: unsupported,
      startScan: unsupported,
      cancelScan: unsupported,
      pauseScan: unsupported,
      dropScan: unsupported,
      children: unsupported,
      node: unsupported,
      query: unsupported,
    };
  }
  const call = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
    try {
      return await invoke<T>(cmd, args);
    } catch (e) {
      throw new Error(typeof e === 'string' ? e : 'error', { cause: e });
    }
  };
  return {
    supported: true,
    listDrives: () => call<DriveInfo[]>('disk_list_drives'),
    async startScan(root, onProgress): Promise<ScanHandle> {
      const channel = new Channel<ScanEvent>();
      let resolve!: (s: ScanSummary) => void;
      let reject!: (e: Error) => void;
      const result = new Promise<ScanSummary>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      channel.onmessage = (msg) => {
        if (msg.event === 'progress') onProgress(msg);
        else if (msg.event === 'done') resolve(msg);
        else reject(new Error(msg.reason));
      };
      const scanId = await call<number>('disk_scan_start', { root, onEvent: channel });
      return { scanId, result };
    },
    cancelScan: (scanId) => call('disk_scan_cancel', { scanId }),
    pauseScan: (scanId, paused) => call('disk_scan_pause', { scanId, paused }),
    dropScan: (scanId) => call('disk_scan_drop', { scanId }),
    children: (scanId, node, depth, minBytes) =>
      call<DiskNode[]>('disk_children', { scanId, node, depth, minBytes }),
    node: (scanId, node) => call<DiskNode | null>('disk_node', { scanId, node }),
    query: (scanId, query: DiskQuery) => call<DiskNode[]>('disk_query', { scanId, query }),
  };
}
