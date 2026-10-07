/**
 * State of the built-in local model for the UI and the pipeline: what the shell reports, a running
 * download or load, and the lazy load before the first request. The model itself lives in Rust.
 */
import { create } from 'zustand';
import { getPlatform } from '@/core/platform';
import type { LocalModelStatus } from '@/core/platform/localModel';
import { downloadUrl, findModelByFile, isVerifiable, type CatalogueModel } from './catalogue';
import { getLocalPrefs } from './prefs';

type Busy = 'download' | 'load' | 'unload' | undefined;

interface LocalModelState {
  status?: LocalModelStatus;
  busy: Busy;
  progress?: { done: number; total: number };
  /** Short code of the last failure (`checksum`, `network`, `not-downloaded`, …). */
  error?: string;
  refresh(): Promise<void>;
  download(model: CatalogueModel): Promise<void>;
  cancelDownload(): void;
  remove(file: string): Promise<void>;
  load(file?: string): Promise<boolean>;
  unload(): Promise<void>;
}

let downloadAbort: AbortController | undefined;
let loading: Promise<boolean> | undefined;

const codeOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export const useLocalModel = create<LocalModelState>((set, get) => ({
  busy: undefined,
  async refresh() {
    try {
      set({ status: await getPlatform().localModel.status() });
    } catch (e) {
      set({ error: codeOf(e) });
    }
  },
  async download(model) {
    if (get().busy || !isVerifiable(model)) return;
    downloadAbort = new AbortController();
    set({ busy: 'download', progress: { done: 0, total: model.bytes }, error: undefined });
    try {
      await getPlatform().localModel.download(
        { file: model.file, url: downloadUrl(model), sha256: model.sha256, bytes: model.bytes },
        (done, total) => set({ progress: { done, total } }),
        downloadAbort.signal,
      );
    } catch (e) {
      set({ error: codeOf(e) });
    } finally {
      downloadAbort = undefined;
      set({ busy: undefined, progress: undefined });
      await get().refresh();
    }
  },
  cancelDownload: () => downloadAbort?.abort(),
  async remove(file) {
    try {
      await getPlatform().localModel.remove(file);
    } catch (e) {
      set({ error: codeOf(e) });
    }
    await get().refresh();
  },
  async load(file) {
    const prefs = getLocalPrefs();
    const target = file ?? prefs.file;
    if (!target) return false;
    if (loading) return loading;
    loading = (async () => {
      set({ busy: 'load', error: undefined });
      try {
        const service = getPlatform().localModel;
        const devices = (await service.status()).devices;
        await service.load(target, { gpu: prefs.gpu && devices.some((d) => d.gpu), context: 4096 });
        return true;
      } catch (e) {
        set({ error: codeOf(e) });
        return false;
      } finally {
        set({ busy: undefined });
        await get().refresh();
        loading = undefined;
      }
    })();
    return loading;
  },
  async unload() {
    set({ busy: 'unload' });
    try {
      await getPlatform().localModel.unload();
    } finally {
      set({ busy: undefined });
      await get().refresh();
    }
  },
}));

/**
 * Can stage 1 be asked right now (or after the lazy load)? Synchronous on purpose: it reads the last
 * status the shell reported, so the pipeline does not wait for the shell before trying the rules.
 */
export function localStageReady(): boolean {
  const { status } = useLocalModel.getState();
  const prefs = getLocalPrefs();
  if (!prefs.first || !prefs.file || !status || status.unavailable) return false;
  const present = status.models.some((m) => m.file === prefs.file);
  return present && findModelByFile(prefs.file) !== undefined;
}

/** Is a local model loaded or being loaded? Drives the "cloud fallback off by default" rule. */
export function localModelActive(): boolean {
  const { status } = useLocalModel.getState();
  const prefs = getLocalPrefs();
  return Boolean(
    prefs.first &&
    prefs.file &&
    status &&
    !status.unavailable &&
    status.models.some((m) => m.file === prefs.file),
  );
}

/** Loads the chosen model if it is not loaded yet (once, shared by concurrent requests). */
export async function ensureLoaded(): Promise<boolean> {
  const prefs = getLocalPrefs();
  const status = await getPlatform().localModel.status();
  if (status.loaded?.file === prefs.file) return true;
  if (!prefs.autoLoad) return false;
  return useLocalModel.getState().load(prefs.file);
}
