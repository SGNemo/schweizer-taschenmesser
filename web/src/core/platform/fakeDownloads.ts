/**
 * E2E stand-in for the native download manager (only wired in `--mode e2e` builds): invented jobs,
 * no network, no files. Progress advances on a timer while a job is `running`; calls are recorded on
 * `window.__tmDownloadCalls` for the specs. Addresses use reserved test domains.
 */
import type { DownloadJob, DownloadsService } from './downloads';

type Win = { __tmDownloadCalls?: string[] };
const MB = 1024 * 1024;
const DIR = 'C:\\Beispiel\\Downloads';

const seed = (): DownloadJob[] => [
  job(
    1,
    'https://mirror.example.org/linux/beispiel-linux-12.iso',
    'beispiel-linux-12.iso',
    'running',
    612 * MB,
    1400 * MB,
    5 * MB,
  ),
  job(
    2,
    'https://dateien.example.org/handbuch.pdf',
    'handbuch.pdf',
    'done',
    4 * MB,
    4 * MB,
    0,
    'ab'.repeat(32),
  ),
  job(3, 'https://dateien.example.org/daten.zip', 'daten.zip', 'paused', 40 * MB, 120 * MB, 0),
];

function job(
  id: number,
  url: string,
  fileName: string,
  state: DownloadJob['state'],
  done: number,
  total: number,
  speedBps: number,
  sha256: string | null = null,
): DownloadJob {
  return {
    id,
    url,
    fileName,
    dir: DIR,
    state,
    done,
    total,
    limitBps: 0,
    speedBps,
    error: null,
    sha256,
    expectedHash: null,
    hashCheck: null,
  };
}

export function createFakeDownloads(): DownloadsService {
  let jobs = seed();
  let next = 10;
  const sinks: Array<(j: DownloadJob[]) => void> = [];
  const log = (c: string) => ((window as unknown as Win).__tmDownloadCalls ??= []).push(c);
  const emit = () => sinks.forEach((s) => s(jobs.map((j) => ({ ...j }))));
  const patch = (id: number, p: Partial<DownloadJob>) => {
    jobs = jobs.map((j) => (j.id === id ? { ...j, ...p } : j));
    emit();
  };
  return {
    supported: true,
    async watch(onList) {
      sinks.push(onList);
      onList(jobs.map((j) => ({ ...j })));
    },
    async defaultDir() {
      return DIR;
    },
    async pickDir() {
      log('pickDir');
      return 'C:\\Beispiel\\Neuer Ordner';
    },
    async add(url, dir, expectedHash) {
      log(`add:${url}:${dir}:${expectedHash ?? ''}`);
      if (!/^https?:\/\//.test(url)) throw new Error('scheme');
      const name = decodeURIComponent(url.split('/').pop() || 'download');
      const j = {
        ...job(next++, url, name, 'queued', 0, 8 * MB, 0),
        dir,
        expectedHash: expectedHash ?? null,
      };
      jobs = [...jobs, j];
      emit();
      return j;
    },
    async pause(id) {
      log(`pause:${id}`);
      patch(id, { state: 'paused', speedBps: 0 });
    },
    async resume(id) {
      log(`resume:${id}`);
      patch(id, { state: 'running', speedBps: 2 * MB });
    },
    async remove(id, deleteData) {
      log(`remove:${id}:${deleteData ? 'data' : 'keep'}`);
      jobs = jobs.filter((j) => j.id !== id);
      emit();
    },
    async setLimit(bps) {
      log(`limit:${bps}`);
    },
    async setJobLimit(id, bps) {
      log(`jobLimit:${id}:${bps}`);
      patch(id, { limitBps: bps });
    },
    async verify(id, expected) {
      log(`verify:${id}`);
      const j = jobs.find((x) => x.id === id);
      patch(id, {
        expectedHash: expected,
        hashCheck: j?.sha256 === expected ? 'match' : 'mismatch',
      });
    },
    async reveal(id) {
      log(`reveal:${id}`);
    },
  };
}
