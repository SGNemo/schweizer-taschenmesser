/**
 * E2E stand-in for the native disk scan (only wired in `--mode e2e` builds, see `web.ts`): an
 * invented folder tree with the same semantics as the Rust side (sums, small-file aggregates,
 * queries). Names and sizes are made up; nothing here touches a real file system.
 */
import {
  FILE_KINDS,
  type DiskNode,
  type DiskQuery,
  type DiskService,
  type DriveInfo,
  type FileKind,
  type ScanProgress,
  type ScanSummary,
} from './disk';

const GB = 1e9;
const MB = 1e6;
/** Reference "now" of the fake data (2025-06-15). */
export const FAKE_NOW = 1_749_945_600;
const DAY = 86_400;

interface FakeFile {
  name: string;
  bytes: number;
  ageDays: number;
}
interface FakeDir {
  name: string;
  ageDays: number;
  dirs?: FakeDir[];
  files?: FakeFile[];
  small?: { count: number; bytes: number; kind?: FileKind };
}

const SPEC: FakeDir = {
  name: '',
  ageDays: 2,
  dirs: [
    {
      name: 'Nutzer',
      ageDays: 1,
      dirs: [
        {
          name: 'Beispiel',
          ageDays: 1,
          dirs: [
            {
              name: 'Videos',
              ageDays: 90,
              files: [
                { name: 'Urlaub-2024.mp4', bytes: 8.2 * GB, ageDays: 400 },
                { name: 'Film.mkv', bytes: 4.1 * GB, ageDays: 90 },
              ],
              small: { count: 12, bytes: 120 * MB, kind: 'video' },
            },
            {
              name: 'Bilder',
              ageDays: 30,
              dirs: [
                {
                  name: 'Sommer',
                  ageDays: 300,
                  small: { count: 2400, bytes: 3.1 * GB, kind: 'image' },
                },
                {
                  name: 'Scans',
                  ageDays: 500,
                  small: { count: 300, bytes: 600 * MB, kind: 'image' },
                },
              ],
            },
            {
              name: 'Dokumente',
              ageDays: 5,
              files: [{ name: 'Steuer.pdf', bytes: 4 * MB, ageDays: 700 }],
              small: { count: 800, bytes: 900 * MB, kind: 'document' },
            },
            {
              name: 'Downloads',
              ageDays: 2,
              files: [
                { name: 'setup-beispiel.exe', bytes: 900 * MB, ageDays: 10 },
                { name: 'archiv.zip', bytes: 2.2 * GB, ageDays: 300 },
                { name: 'alt.iso', bytes: 5 * GB, ageDays: 800 },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'Programme',
      ageDays: 60,
      dirs: [
        {
          name: 'Editor',
          ageDays: 60,
          files: [{ name: 'Editor.exe', bytes: 300 * MB, ageDays: 60 }],
          small: { count: 4000, bytes: 2.5 * GB, kind: 'program' },
        },
        {
          name: 'Spiel',
          ageDays: 200,
          files: [{ name: 'daten.pak', bytes: 42 * GB, ageDays: 200 }],
        },
      ],
    },
    { name: 'System', ageDays: 20, small: { count: 90_000, bytes: 22 * GB, kind: 'other' } },
  ],
  files: [{ name: 'auslagerung.sys', bytes: 6 * GB, ageDays: 1 }],
};

const kindIndex = (k: FileKind) => FILE_KINDS.indexOf(k);

function fileKindOf(name: string): FileKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return 'video';
  if (['jpg', 'png', 'heic'].includes(ext)) return 'image';
  if (['mp3', 'flac'].includes(ext)) return 'audio';
  if (['zip', 'iso', '7z'].includes(ext)) return 'archive';
  if (['exe', 'dll', 'sys'].includes(ext)) return 'program';
  if (['pdf', 'docx', 'txt'].includes(ext)) return 'document';
  return 'other';
}

class FakeTree {
  readonly nodes: DiskNode[] = [];

  constructor(root: string, spec: FakeDir = SPEC) {
    this.add(null, { ...spec, name: root });
  }

  private push(n: Omit<DiskNode, 'id' | 'fileKind'> & { fileKind?: FileKind }): number {
    const id = this.nodes.length;
    this.nodes.push({ ...n, id, fileKind: n.fileKind ?? 'other' });
    return id;
  }

  private add(parentId: number | null, d: FakeDir): number {
    const id = this.push({
      parentId,
      name: d.name,
      kind: 'dir',
      bytes: 0,
      logicalBytes: 0,
      files: 0,
      modified: FAKE_NOW - d.ageDays * DAY,
      kindBytes: FILE_KINDS.map(() => 0),
      childCount: 0,
    });
    const kids: number[] = [];
    for (const c of d.dirs ?? []) kids.push(this.add(id, c));
    for (const f of d.files ?? []) {
      const kb = FILE_KINDS.map(() => 0);
      const fk = fileKindOf(f.name);
      kb[kindIndex(fk)] = f.bytes;
      kids.push(
        this.push({
          parentId: id,
          name: f.name,
          kind: 'file',
          bytes: f.bytes,
          logicalBytes: f.bytes,
          files: 1,
          modified: FAKE_NOW - f.ageDays * DAY,
          fileKind: fk,
          kindBytes: kb,
          childCount: 0,
        }),
      );
    }
    if (d.small) {
      const kb = FILE_KINDS.map(() => 0);
      const fk = d.small.kind ?? 'other';
      kb[kindIndex(fk)] = d.small.bytes;
      kids.push(
        this.push({
          parentId: id,
          name: '',
          kind: 'small',
          bytes: d.small.bytes,
          logicalBytes: d.small.bytes,
          files: d.small.count,
          modified: FAKE_NOW - d.ageDays * DAY,
          fileKind: fk,
          kindBytes: kb,
          childCount: 0,
        }),
      );
    }
    const node = this.nodes[id]!;
    for (const k of kids) {
      const c = this.nodes[k]!;
      node.bytes += c.bytes;
      node.logicalBytes += c.logicalBytes;
      node.files += c.files;
      node.modified = Math.max(node.modified, c.modified);
      c.kindBytes.forEach((b, i) => (node.kindBytes[i]! += b));
    }
    node.childCount = kids.length;
    let best = 0;
    node.kindBytes.forEach((b, i) => {
      if (b > node.kindBytes[best]!) best = i;
    });
    node.fileKind = FILE_KINDS[best]!;
    this.kids.set(id, kids);
    return id;
  }

  readonly kids = new Map<number, number[]>();

  children(id: number, depth: number, minBytes: number): DiskNode[] {
    const out: DiskNode[] = [];
    let level = [id];
    for (let d = 0; d < depth; d++) {
      const next: number[] = [];
      for (const p of level) {
        const sorted = (this.kids.get(p) ?? [])
          .filter((c) => this.nodes[c]!.bytes >= minBytes)
          .sort((a, b) => this.nodes[b]!.bytes - this.nodes[a]!.bytes);
        for (const c of sorted) {
          out.push(this.nodes[c]!);
          next.push(c);
        }
      }
      if (!next.length) break;
      level = next;
    }
    return out;
  }

  private isUnder(id: number | null, ancestor: number): boolean {
    for (let cur = id; cur !== null; cur = this.nodes[cur]!.parentId)
      if (cur === ancestor) return true;
    return false;
  }

  query(q: DiskQuery): DiskNode[] {
    const want = q.scope === 'dirs' ? 'dir' : 'file';
    const under = q.under ?? 0;
    const hits: { key: number; n: DiskNode }[] = [];
    for (const n of this.nodes) {
      if (n.kind !== want || (want === 'dir' && n.id === under)) continue;
      if (under !== 0 && !this.isUnder(n.id, under)) continue;
      if (q.olderThan !== undefined && n.modified >= q.olderThan) continue;
      const key = q.fileKind ? n.kindBytes[kindIndex(q.fileKind)]! : n.bytes;
      if (key === 0 || n.bytes < (q.minBytes ?? 0)) continue;
      hits.push({ key, n });
    }
    hits.sort((a, b) => b.key - a.key || a.n.id - b.n.id);
    return hits.slice(0, Math.min(q.limit ?? 100, 500)).map((h) => h.n);
  }
}

const DRIVES: DriveInfo[] = [
  {
    root: 'C:\\',
    label: 'System',
    fileSystem: 'NTFS',
    kind: 'fixed',
    media: 'ssd',
    totalBytes: 512 * GB,
    freeBytes: 41 * GB,
  },
  {
    root: 'D:\\',
    label: 'Daten',
    fileSystem: 'NTFS',
    kind: 'fixed',
    media: 'hdd',
    totalBytes: 2000 * GB,
    freeBytes: 1300 * GB,
  },
  {
    root: 'E:\\',
    label: 'USB-Stick',
    fileSystem: 'exFAT',
    kind: 'removable',
    media: 'unknown',
    totalBytes: 64 * GB,
    freeBytes: 20 * GB,
  },
];

/** A scan takes ~0.3 s so tests can see the progress state and press "Abbrechen". */
export function createFakeDisk(): DiskService {
  const scans = new Map<number, { tree: FakeTree; cancelled: boolean; paused: boolean }>();
  let nextId = 0;
  const get = (id: number) => {
    const s = scans.get(id);
    if (!s) throw new Error('unknown-scan');
    return s;
  };
  return {
    supported: true,
    listDrives: async () => DRIVES,
    async startScan(root, onProgress) {
      const scanId = ++nextId;
      const state = { tree: new FakeTree(root), cancelled: false, paused: false };
      scans.set(scanId, state);
      const total = state.tree.nodes[0]!;
      const result = new Promise<ScanSummary>((resolve) => {
        let step = 0;
        const steps = 6;
        const tick = () => {
          if (state.paused && !state.cancelled) return void setTimeout(tick, 50);
          step++;
          const f = state.cancelled ? step / steps : Math.min(step / steps, 1);
          const p: ScanProgress = {
            files: Math.round(total.files * f),
            dirs: 12,
            bytes: Math.round(total.bytes * f),
            current: `${root}Nutzer\\Beispiel\\Bilder`,
          };
          onProgress(p);
          if (state.cancelled || step >= steps) {
            resolve({
              scanId,
              root,
              rootNode: { ...total, name: root },
              cancelled: state.cancelled,
              files: total.files,
              dirs: 12,
              bytes: total.bytes,
              logicalBytes: total.logicalBytes,
              cloudBytes: 0,
              skippedLinks: 1,
              notRead: [{ path: `${root}System\\Geschützt`, reason: 'denied' }],
              notReadTotal: 1,
              elapsedMs: 300,
            });
          } else setTimeout(tick, 60);
        };
        setTimeout(tick, 60);
      });
      return { scanId, result };
    },
    async cancelScan(id) {
      get(id).cancelled = true;
    },
    async pauseScan(id, paused) {
      get(id).paused = paused;
    },
    async dropScan(id) {
      scans.delete(id);
    },
    async children(id, node, depth, minBytes) {
      return get(id).tree.children(node, depth, minBytes);
    },
    async node(id, node) {
      return get(id).tree.nodes[node] ?? null;
    },
    async query(id, q) {
      return get(id).tree.query(q);
    },
  };
}
