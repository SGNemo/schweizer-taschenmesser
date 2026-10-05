/**
 * The built-in local language model (desktop only). The Rust side (`src-tauri/src/local_llm.rs`,
 * `crates/local-llm`) runs llama.cpp in-process and downloads model files after the user confirmed;
 * nothing leaves the device. The frontend passes file names, never paths.
 */

/** A model file on disk; only files whose download was verified are listed. */
export interface LocalModelFile {
  file: string;
  bytes: number;
}

export interface LocalModelInfo {
  parameters: number;
  fileBytes: number;
  trainContext: number;
  layers: number;
  recurrent: boolean;
  /** What the weights actually run on. */
  backend: 'cpu' | 'gpu';
  loadMs: number;
}

export interface LocalModelDevice {
  name: string;
  description: string;
  backend: string;
  memoryTotal: number;
  memoryFree: number;
  gpu: boolean;
}

export interface LocalModelStatus {
  /** Why the model cannot be used here: not the desktop app, built without it, CPU too old. */
  unavailable?: 'platform' | 'build' | 'cpu';
  models: LocalModelFile[];
  loaded?: { file: string; info: LocalModelInfo };
  /** ggml devices of this build; a GPU entry means the GPU backend is built in and a driver exists. */
  devices: LocalModelDevice[];
  /** The models folder (inside the data folder). */
  folder?: string;
}

/** What is downloaded: size and SHA-256 come from the catalogue and are checked by the shell. */
export interface LocalModelDownload {
  file: string;
  url: string;
  sha256: string;
  bytes: number;
}

export interface LocalGenerateRequest {
  /** The fully formatted prompt (chat template applied). */
  prompt: string;
  /** GBNF grammar; the answer can only be text the grammar allows. */
  grammar?: string;
  maxTokens: number;
}

export type LocalStopReason = 'done' | 'max-tokens' | 'cancelled' | 'context-full';

export interface LocalGenerateResult {
  text: string;
  promptTokens: number;
  /** Prompt tokens that were still in the cache from the previous request. */
  cachedTokens: number;
  generatedTokens: number;
  promptMs: number;
  generateMs: number;
  stop: LocalStopReason;
}

export interface LocalModelService {
  /** True only in the desktop app (the Rust build may still lack the model: see `status().unavailable`). */
  supported: boolean;
  status(): Promise<LocalModelStatus>;
  /** Downloads and verifies; rejects with `checksum`, `size`, `network`, `cancelled`, `busy` or `io`. */
  download(
    spec: LocalModelDownload,
    onProgress: (done: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<void>;
  remove(file: string): Promise<void>;
  load(file: string, options: { gpu: boolean; context: number }): Promise<LocalModelInfo>;
  unload(): Promise<void>;
  generate(
    request: LocalGenerateRequest,
    options?: { onToken?: (piece: string) => void; signal?: AbortSignal },
  ): Promise<LocalGenerateResult>;
}

const unsupported = (): Promise<never> => Promise.reject(new Error('unsupported'));

/** For the browser, Android and tests that do not care: nothing to offer. */
export const noLocalModel: LocalModelService = {
  supported: false,
  status: () => Promise.resolve({ unavailable: 'platform', models: [], devices: [] }),
  download: unsupported,
  remove: unsupported,
  load: unsupported,
  unload: () => Promise.resolve(),
  generate: unsupported,
};
