/**
 * E2E stand-in for the native disk scan (only wired in `--mode e2e` builds, see `web.ts`): an
 * invented folder tree with the same semantics as the Rust side (sums, small-file aggregates,
 * queries). Names and sizes are made up; nothing here touches a real file system.
 */
import {
  FILE_KINDS,
  type DeleteItemReport,
  type DeleteMode,
  type DeletePlan,
  type DenyReason,
  type DiskNode,
  type DiskQuery,
  type DiskService,
  type DriveInfo,
  type DupGroup,
  type FileKind,
  type PlanFlag,
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
                { name: 'Urlaub-2024 (Kopie).mp4', bytes: 8.2 * GB, ageDays: 5 },
              ],
              dirs: [{ name: 'Leer', ageDays: 200 }],
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
  private readonly removed = new Set<number>();

  nameOf(id: number): string {
    return this.nodes[id]!.name;
  }

  pathOf(id: number): string {
    const parts: string[] = [];
    for (let cur = id; cur !== 0; cur = this.nodes[cur]!.parentId!)
      parts.unshift(this.nodes[cur]!.name);
    const root = this.nodes[0]!.name;
    return [root.replace(/[\\/]+$/, ''), ...parts].join('\\') + (parts.length ? '' : '\\');
  }

  isRemoved(id: number): boolean {
    return this.removed.has(id);
  }

  /** Takes an entry out and subtracts its sums from the folders above (like the native tree). */
  remove(id: number): void {
    const n = this.nodes[id]!;
    if (id === 0 || this.removed.has(id)) return;
    for (let cur = n.parentId; cur !== null; cur = this.nodes[cur]!.parentId) {
      const a = this.nodes[cur]!;
      a.bytes -= n.bytes;
      a.logicalBytes -= n.logicalBytes;
      a.files -= n.files;
      n.kindBytes.forEach((b, i) => (a.kindBytes[i]! -= b));
    }
    const parent = this.kids.get(n.parentId!)!;
    parent.splice(parent.indexOf(id), 1);
    this.nodes[n.parentId!]!.childCount = parent.length;
    const stack = [id];
    while (stack.length) {
      const x = stack.pop()!;
      this.removed.add(x);
      stack.push(...(this.kids.get(x) ?? []));
    }
  }

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
          out.push({ ...this.nodes[c]! });
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
      if (this.removed.has(n.id) || n.kind !== want || (want === 'dir' && n.id === under)) continue;
      if (under !== 0 && !this.isUnder(n.id, under)) continue;
      if (q.olderThan !== undefined && n.modified >= q.olderThan) continue;
      if (q.onlyEmpty) {
        if (n.kind === 'dir' && n.files === 0 && n.bytes === 0) hits.push({ key: 0, n });
        continue;
      }
      const key = q.fileKind ? n.kindBytes[kindIndex(q.fileKind)]! : n.bytes;
      if (key === 0 || n.bytes < (q.minBytes ?? 0)) continue;
      hits.push({ key, n });
    }
    hits.sort((a, b) => b.key - a.key || a.n.id - b.n.id);
    return hits
      .slice(0, Math.min(q.limit ?? 100, 500))
      .map((h) => ({ ...h.n, relPath: this.parentPath(h.n.id) }));
  }

  private parentPath(id: number): string {
    const names: string[] = [];
    for (
      let cur = this.nodes[id]!.parentId;
      cur !== null && cur !== 0;
      cur = this.nodes[cur]!.parentId
    )
      names.unshift(this.nodes[cur]!.name);
    return names.join('\\');
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
    bus: 'nvme',
    model: 'Beispiel NVMe 512',
    isSystem: true,
    health: { status: 'ok', temperatureC: 41, gap: null },
  },
  {
    root: 'D:\\',
    label: 'Daten',
    fileSystem: 'NTFS',
    kind: 'fixed',
    media: 'hdd',
    totalBytes: 2000 * GB,
    freeBytes: 1300 * GB,
    bus: 'sata',
    model: 'Beispiel HDD 2TB',
    isSystem: false,
    health: { status: 'unknown', temperatureC: null, gap: 'needsAdmin' },
  },
  {
    root: 'E:\\',
    label: 'USB-Stick',
    fileSystem: 'exFAT',
    kind: 'removable',
    media: 'unknown',
    totalBytes: 64 * GB,
    freeBytes: 20 * GB,
    bus: 'usb',
    model: 'Beispiel USB-Stick',
    isSystem: false,
    health: { status: 'unknown', temperatureC: null, gap: 'unsupported' },
  },
];

const TRASH_LIMIT = 10 * 1024 ** 3;
const LARGE_FILES = 10_000;

/** Block list of the fake: a few invented protected entries, checked when planning and running. */
function denyReason(tree: FakeTree, id: number): DenyReason | null {
  const n = tree.nodes[id];
  if (!n || tree.isRemoved(id)) return 'missing';
  if (id === 0) return 'scan-root';
  if (n.kind === 'small') return 'not-an-entry';
  if (n.name === 'System' && n.parentId === 0) return 'system-folder';
  if (n.name === 'auslagerung.sys') return 'system-file';
  if (n.name === 'Nutzer' || n.name === 'Beispiel') return 'user-profile';
  return null;
}

const USER_DIRS = ['Dokumente', 'Bilder', 'Videos'];

function flagsOf(tree: FakeTree, id: number): PlanFlag[] {
  const n = tree.nodes[id]!;
  const flags: PlanFlag[] = [];
  if (n.bytes > TRASH_LIMIT || n.files > LARGE_FILES) flags.push('large');
  const path = tree.pathOf(id);
  if (USER_DIRS.some((d) => path.includes(`\\Beispiel\\${d}`))) flags.push('userData');
  if (n.kindBytes[FILE_KINDS.indexOf('program')]! > 0) flags.push('program');
  return flags;
}

function requiredPhrase(plan: DeletePlan, mode: DeleteMode): string | null {
  const large =
    plan.totalBytes > TRASH_LIMIT ||
    plan.totalFiles > LARGE_FILES ||
    plan.items.some((i) => i.flags.includes('large'));
  if (mode !== 'permanent' && !large) return null;
  return plan.items.length === 1 ? plan.items[0]!.name : 'LÖSCHEN';
}

/** A scan takes ~0.3 s so tests can see the progress state and press "Abbrechen". */
export function createFakeDisk(): DiskService {
  interface State {
    tree: FakeTree;
    cancelled: boolean;
    paused: boolean;
    dupCancelled: boolean;
  }
  const scans = new Map<number, State>();
  const plans = new Map<number, { scanId: number; plan: DeletePlan; cancelled: boolean }>();
  let nextId = 0;
  const get = (id: number) => {
    const s = scans.get(id);
    if (!s) throw new Error('unknown-scan');
    return s;
  };
  const drive = (t: FakeTree) =>
    t.nodes[0]!.name.startsWith('E:') ? ('removable' as const) : ('fixed' as const);
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  (globalThis as { __tmDiskRevealed?: string[] }).__tmDiskRevealed = [];

  return {
    supported: true,
    listDrives: async () => DRIVES,
    async startScan(root, onProgress) {
      const scanId = ++nextId;
      const state: State = {
        tree: new FakeTree(root),
        cancelled: false,
        paused: false,
        dupCancelled: false,
      };
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
      const t = get(id).tree;
      const n = t.nodes[node];
      if (!n || t.isRemoved(node)) return null;
      return { ...n, name: node === 0 ? t.nodes[0]!.name : n.name };
    },
    async query(id, q) {
      return get(id).tree.query(q);
    },

    async knownPlaces() {
      return [
        { id: 'temp', path: 'C:\\Nutzer\\Beispiel\\AppData\\Local\\Temp' },
        { id: 'chrome', path: 'C:\\Nutzer\\Beispiel\\AppData\\Local\\Chrome\\Cache' },
        { id: 'downloads', path: 'C:\\Nutzer\\Beispiel\\Downloads' },
      ];
    },
    async placeSizes() {
      return [
        {
          id: 'temp',
          path: 'C:\\Nutzer\\Beispiel\\AppData\\Local\\Temp',
          sizeBytes: 3.4 * GB,
          partial: false,
        },
        {
          id: 'chrome',
          path: 'C:\\Nutzer\\Beispiel\\AppData\\Local\\Chrome\\Cache',
          sizeBytes: 0.9 * GB,
          partial: false,
        },
        {
          id: 'downloads',
          path: 'C:\\Nutzer\\Beispiel\\Downloads',
          sizeBytes: 12.3 * GB,
          partial: true,
        },
      ];
    },
    async recycleSize() {
      return 1.2 * GB;
    },
    async nodePath(id, node) {
      return get(id).tree.pathOf(node);
    },
    async reveal(id, node) {
      (globalThis as { __tmDiskRevealed?: string[] }).__tmDiskRevealed!.push(
        get(id).tree.pathOf(node),
      );
    },
    async canDelete(id, node) {
      return denyReason(get(id).tree, node);
    },
    async planDelete(id, nodes) {
      const tree = get(id).tree;
      const items: DeletePlan['items'] = [];
      const denied: DeletePlan['denied'] = [];
      for (const nid of [...new Set(nodes)]) {
        const why = denyReason(tree, nid);
        if (why) {
          denied.push({ nodeId: nid, name: tree.nameOf(nid), reason: why });
          continue;
        }
        const n = tree.nodes[nid]!;
        items.push({
          nodeId: nid,
          name: n.name,
          path: tree.pathOf(nid),
          isDir: n.kind === 'dir',
          bytes: n.bytes,
          files: n.files,
          flags: flagsOf(tree, nid),
          drive: drive(tree),
        });
      }
      // Entries inside another selected entry are covered by it.
      const covered = (nid: number) =>
        items.some((o) => o.nodeId !== nid && tree.pathOf(nid).startsWith(`${o.path}\\`));
      const kept = items.filter((i) => !covered(i.nodeId));
      const plan: DeletePlan = {
        planId: ++nextId,
        items: kept,
        denied,
        totalBytes: kept.reduce((s, i) => s + i.bytes, 0),
        totalFiles: kept.reduce((s, i) => s + i.files, 0),
        large: false,
        trashConfirmation: null,
        permanentConfirmation: null,
        trashLikely: kept.every((i) => i.drive === 'fixed'),
      };
      plan.large = plan.totalBytes > TRASH_LIMIT || plan.totalFiles > LARGE_FILES;
      plan.trashConfirmation = requiredPhrase(plan, 'trash');
      plan.permanentConfirmation = requiredPhrase(plan, 'permanent');
      plans.set(plan.planId, { scanId: id, plan, cancelled: false });
      return plan;
    },
    async runDelete(planId, mode, confirm, onProgress) {
      const stored = plans.get(planId);
      if (!stored) throw new Error('unknown-plan');
      const need = requiredPhrase(stored.plan, mode);
      if (need !== null && confirm?.trim() !== need) throw new Error('confirmation-mismatch');
      const tree = get(stored.scanId).tree;
      const items: DeleteItemReport[] = [];
      let freed = 0;
      let files = 0;
      for (const [i, it] of stored.plan.items.entries()) {
        onProgress({
          itemsDone: i,
          itemsTotal: stored.plan.items.length,
          current: it.name,
          filesDeleted: files,
        });
        await wait(150);
        const base = {
          node: it.nodeId,
          name: it.name,
          filesDeleted: 0,
          bytes: 0,
          errors: [],
          errorsTotal: 0,
        };
        if (stored.cancelled) {
          items.push({ ...base, outcome: 'cancelled', reason: null });
          continue;
        }
        const why = denyReason(tree, it.nodeId);
        if (why) {
          items.push({ ...base, outcome: 'skipped', reason: why });
        } else if (mode === 'trash' && it.drive !== 'fixed') {
          items.push({ ...base, outcome: 'trashUnavailable', reason: null });
        } else if (it.name === 'Editor') {
          // A program that is running: its files cannot be removed.
          const exe = `${it.path}\\Editor.exe`;
          if (mode === 'trash')
            items.push({
              ...base,
              outcome: 'failed',
              reason: 'in-use',
              errors: [{ path: exe, reason: 'in-use' }],
              errorsTotal: 1,
            });
          else {
            files += it.files - 1;
            items.push({
              ...base,
              outcome: 'partial',
              reason: 'in-use',
              filesDeleted: it.files - 1,
              errors: [{ path: exe, reason: 'in-use' }],
              errorsTotal: 1,
            });
          }
        } else {
          tree.remove(it.nodeId);
          freed += it.bytes;
          files += it.files;
          items.push({
            ...base,
            outcome: 'deleted',
            reason: null,
            filesDeleted: it.files,
            bytes: it.bytes,
          });
        }
      }
      onProgress({
        itemsDone: items.length,
        itemsTotal: items.length,
        current: '',
        filesDeleted: files,
      });
      plans.delete(planId);
      return {
        mode,
        items,
        cancelled: stored.cancelled,
        filesDeleted: files,
        freedBytes: freed,
        rootNode: { ...tree.nodes[0]! },
      };
    },
    async cancelDelete(planId) {
      const p = plans.get(planId);
      if (p) p.cancelled = true;
    },
    async findDuplicates(id, under) {
      const state = get(id);
      state.dupCancelled = false;
      await wait(150);
      if (state.dupCancelled) throw new Error('cancelled');
      const files = state.tree.query({ scope: 'files', under: under || undefined, limit: 500 });
      const bySize = new Map<number, DiskNode[]>();
      for (const f of files) bySize.set(f.logicalBytes, [...(bySize.get(f.logicalBytes) ?? []), f]);
      const groups: DupGroup[] = [...bySize.entries()]
        .filter(([, list]) => list.length > 1)
        .map(([size, list]) => ({ size, wasted: size * (list.length - 1), files: list }))
        .sort((a, b) => b.wasted - a.wasted);
      return groups;
    },
    async cancelDuplicates(id) {
      get(id).dupCancelled = true;
    },
  };
}
