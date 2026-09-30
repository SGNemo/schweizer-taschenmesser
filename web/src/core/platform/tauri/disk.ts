import { Channel, invoke } from '@tauri-apps/api/core';
import type {
  DeleteMode,
  DeletePlan,
  DeleteProgress,
  DeleteReport,
  DenyReason,
  DiskNode,
  DiskQuery,
  DiskService,
  DriveInfo,
  DupGroup,
  Place,
  ScanHandle,
  ScanProgress,
  ScanSummary,
} from '../disk';

type ScanEvent =
  | ({ event: 'progress' } & ScanProgress)
  | ({ event: 'done' } & ScanSummary)
  | { event: 'failed'; reason: string };

type DeleteEvent = ({ event: 'progress' } & DeleteProgress) | ({ event: 'done' } & DeleteReport);
type DupEvent = { event: 'done'; groups: DupGroup[] } | { event: 'failed'; reason: string };

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
      knownPlaces: unsupported,
      nodePath: unsupported,
      reveal: unsupported,
      canDelete: unsupported,
      planDelete: unsupported,
      runDelete: unsupported,
      cancelDelete: unsupported,
      findDuplicates: unsupported,
      cancelDuplicates: unsupported,
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
    knownPlaces: () => call<Place[]>('disk_known_places'),
    nodePath: (scanId, node) => call<string>('disk_node_path', { scanId, node }),
    reveal: (scanId, node) => call('disk_reveal', { scanId, node }),
    canDelete: (scanId, node) => call<DenyReason | null>('disk_can_delete', { scanId, node }),
    planDelete: (scanId, nodes) => call<DeletePlan>('disk_delete_plan', { scanId, nodes }),
    async runDelete(planId, mode: DeleteMode, confirm, onProgress) {
      const channel = new Channel<DeleteEvent>();
      const result = new Promise<DeleteReport>((resolve) => {
        channel.onmessage = (msg) => {
          if (msg.event === 'progress') onProgress(msg);
          else resolve(msg);
        };
      });
      await call('disk_delete', { planId, mode, confirm, onEvent: channel });
      return result;
    },
    cancelDelete: (planId) => call('disk_delete_cancel', { planId }),
    async findDuplicates(scanId, under) {
      const channel = new Channel<DupEvent>();
      const result = new Promise<DupGroup[]>((resolve, reject) => {
        channel.onmessage = (msg) =>
          msg.event === 'done' ? resolve(msg.groups) : reject(new Error(msg.reason));
      });
      await call('disk_find_duplicates', { scanId, under, onEvent: channel });
      return result;
    },
    cancelDuplicates: (scanId) => call('disk_duplicates_cancel', { scanId }),
  };
}
