/**
 * Stand-in for the native local model in tests and E2E builds: a scripted answer, a tiny "download".
 * Invented values only; it never touches the disk.
 */
import type {
  LocalGenerateRequest,
  LocalGenerateResult,
  LocalModelFile,
  LocalModelInfo,
  LocalModelService,
  LocalModelStatus,
} from './localModel';

export interface FakeLocalModelOptions {
  /** Produces the answer text for a prompt; default: an empty proposal. */
  answer?: (request: LocalGenerateRequest) => string;
  /** Models that are already "downloaded". */
  models?: LocalModelFile[];
  gpu?: boolean;
  /** Make the next download fail with this code. */
  downloadError?: string;
}

export interface FakeLocalModel extends LocalModelService {
  /** Every request seen, in order (tests assert on prompt and grammar). */
  readonly requests: LocalGenerateRequest[];
  readonly downloads: string[];
}

export function createFakeLocalModel(options: FakeLocalModelOptions = {}): FakeLocalModel {
  const models = [...(options.models ?? [])];
  let loaded: { file: string; info: LocalModelInfo } | undefined;
  const requests: LocalGenerateRequest[] = [];
  const downloads: string[] = [];
  const answer = options.answer ?? (() => JSON.stringify({ ops: [], confidence: 0, question: '' }));
  return {
    supported: true,
    requests,
    downloads,
    async status(): Promise<LocalModelStatus> {
      return {
        models: [...models],
        loaded,
        devices: [
          {
            name: 'CPU',
            description: 'Beispiel-Prozessor',
            backend: 'CPU',
            memoryTotal: 0,
            memoryFree: 0,
            gpu: false,
          },
          ...(options.gpu
            ? [
                {
                  name: 'Vulkan0',
                  description: 'Beispiel-Grafik 4000',
                  backend: 'Vulkan',
                  memoryTotal: 8 * 1024 ** 3,
                  memoryFree: 7 * 1024 ** 3,
                  gpu: true,
                },
              ]
            : []),
        ],
        folder: '/beispiel/daten/models',
      };
    },
    async download(spec, onProgress, signal) {
      if (options.downloadError) throw new Error(options.downloadError);
      downloads.push(spec.file);
      for (const step of [0, 0.5, 1]) {
        if (signal?.aborted) throw new Error('cancelled');
        onProgress(Math.round(spec.bytes * step), spec.bytes);
      }
      models.push({ file: spec.file, bytes: spec.bytes });
    },
    async remove(file) {
      const i = models.findIndex((m) => m.file === file);
      if (i >= 0) models.splice(i, 1);
      if (loaded?.file === file) loaded = undefined;
    },
    async load(file, opts) {
      if (!models.some((m) => m.file === file)) throw new Error('not-downloaded');
      const info: LocalModelInfo = {
        parameters: 4_000_000_000,
        fileBytes: models.find((m) => m.file === file)!.bytes,
        trainContext: 32768,
        layers: 36,
        recurrent: false,
        backend: opts.gpu && options.gpu ? 'gpu' : 'cpu',
        loadMs: 1200,
      };
      loaded = { file, info };
      return info;
    },
    async unload() {
      loaded = undefined;
    },
    async generate(request, opts): Promise<LocalGenerateResult> {
      if (!loaded) throw new Error('not-loaded');
      requests.push(request);
      if (opts?.signal?.aborted) throw new Error('cancelled');
      const text = answer(request);
      opts?.onToken?.(text);
      return {
        text,
        promptTokens: 900,
        cachedTokens: requests.length > 1 ? 850 : 0,
        generatedTokens: Math.ceil(text.length / 4),
        promptMs: 400,
        generateMs: 900,
        stop: 'done',
      };
    },
  };
}
