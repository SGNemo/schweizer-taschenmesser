/**
 * E2E stand-in for the torrent engine (only wired in `--mode e2e` builds): invented torrents with
 * made-up names, no network, no peers, no files. Calls are recorded on `window.__tmTorrentCalls`.
 */
import type { TorrentInfo, TorrentPreview, TorrentService } from './torrent';

type Win = { __tmTorrentCalls?: string[] };
const MB = 1024 * 1024;
const DIR = 'C:\\Beispiel\\Downloads';

const PREVIEW: TorrentPreview = {
  infoHash: 'a'.repeat(40),
  name: 'beispiel-linux-12',
  total: 1000 * MB,
  files: [
    { index: 0, path: 'beispiel-linux-12.iso', size: 900 * MB },
    { index: 1, path: 'SHA256SUMS', size: 1024 },
    { index: 2, path: 'handbuch/anleitung.pdf', size: 99 * MB },
  ],
};

const seed = (): TorrentInfo[] => [
  info(1, 'beispiel-linux-11', 'seeding', 700 * MB, 700 * MB, 0, 120 * 1024, 4, 0.6),
  info(2, 'freie-musik-sammlung', 'downloading', 220 * MB, 480 * MB, 2 * MB, 64 * 1024, 7, 0.1),
  info(3, 'beispiel-karten', 'paused', 40 * MB, 120 * MB, 0, 0, 0, 0),
];

function info(
  id: number,
  name: string,
  state: TorrentInfo['state'],
  done: number,
  total: number,
  down: number,
  up: number,
  peers: number,
  ratio: number,
): TorrentInfo {
  return {
    id,
    infoHash: String(id).repeat(40).slice(0, 40),
    name,
    dir: DIR,
    state,
    progressBytes: done,
    totalBytes: total,
    uploadedBytes: Math.round(total * ratio),
    downBps: down,
    upBps: up,
    peers,
    ratio,
    error: null,
  };
}

export function createFakeTorrent(): TorrentService {
  let torrents = seed();
  let next = 10;
  let started = false;
  const sinks: Array<(t: TorrentInfo[]) => void> = [];
  const log = (c: string) => ((window as unknown as Win).__tmTorrentCalls ??= []).push(c);
  const emit = () => sinks.forEach((s) => s(torrents.map((t) => ({ ...t }))));
  const patch = (id: number, p: Partial<TorrentInfo>) => {
    torrents = torrents.map((t) => (t.id === id ? { ...t, ...p } : t));
    emit();
  };
  return {
    supported: true,
    async configure(s) {
      started = true;
      log(
        `configure:${s.dht}:${s.upnp}:${s.uploadKb}:${s.downloadKb}:${s.seedRatio}:${s.seedMinutes}`,
      );
    },
    async stop() {
      log('stop');
      started = false;
    },
    async preview(source) {
      log(`preview:${source.kind}`);
      if (!started) throw new Error('off');
      if (source.kind === 'magnet' && !source.value.startsWith('magnet:?'))
        throw new Error('not-a-magnet');
      return PREVIEW;
    },
    async add(source, dir, files) {
      log(`add:${source.kind}:${dir}:${files ? files.join(',') : 'all'}`);
      const id = next++;
      torrents = [...torrents, info(id, PREVIEW.name, 'starting', 0, PREVIEW.total, 0, 0, 0, 0)];
      torrents = torrents.map((t) => (t.id === id ? { ...t, dir } : t));
      emit();
      return id;
    },
    async pause(id) {
      log(`pause:${id}`);
      patch(id, { state: 'paused', downBps: 0, upBps: 0 });
    },
    async resume(id) {
      log(`resume:${id}`);
      patch(id, { state: 'downloading', downBps: MB });
    },
    async remove(id, deleteData) {
      log(`remove:${id}:${deleteData ? 'data' : 'keep'}`);
      torrents = torrents.filter((t) => t.id !== id);
      emit();
    },
    async watch(onList) {
      sinks.push(onList);
      onList(torrents.map((t) => ({ ...t })));
    },
    async pickFile() {
      log('pickFile');
      return 'C:\\Beispiel\\beispiel.torrent';
    },
  };
}
