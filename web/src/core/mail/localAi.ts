/**
 * The only door from mail text to a model – and it only opens to a model on this machine.
 *
 * Mail content never goes to a cloud model. This file is where that is enforced for the optional
 * "local model may read mail" setting: it resolves exactly two kinds of model –
 *   1. the built-in model (`platform.localModel`, runs inside the app, nothing leaves the process), and
 *   2. an Ollama server the user configured **on this computer** (loopback address only: `localhost`,
 *      `127.x.x.x`, `::1`; not even a server in the home network),
 * and nothing else. There is no router, no fallback to a cloud provider, no "cloud notice" path: if no
 * local model is ready the answer is "none", never "try the next provider". The Ollama call goes through a
 * `fetch` that refuses any non-loopback address and any redirect, so a changed address or a redirect cannot
 * carry the text off the machine. Pinned by `localAi.test.ts` and `isolation.test.ts`.
 */
import { loadAiConfig, isEntryUsable, type AiConfig } from '@/core/ai/config';
import { findModelByFile } from '@/core/ai/local/catalogue';
import { getLocalPrefs } from '@/core/ai/local/prefs';
import { formatChat } from '@/core/ai/local/prompts/v1';
import { ensureLoaded, useLocalModel } from '@/core/ai/local/state';
import { createOllamaProvider } from '@/core/ai/providers/ollama';
import { getPlatform } from '@/core/platform';

export type LocalOnlyCode = 'no-model' | 'remote-host';

export class LocalOnlyError extends Error {
  constructor(readonly code: LocalOnlyCode) {
    super(code);
    this.name = 'LocalOnlyError';
  }
}

/** `localhost`, `*.localhost`, 127.0.0.0/8, ::1 – this machine only (not the home network). */
export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (/^127\.\d+\.\d+\.\d+$/.test(host)) return true;
  return host === '::1';
}

export interface LocalMailModel {
  source: 'built-in' | 'ollama';
  /** Name of the model, for the "answered by" line. */
  model: string;
  /** Plain text in, plain text out: no tools, no grammar, nothing is stored. */
  complete(
    system: string,
    user: string,
    opts?: { maxTokens?: number; signal?: AbortSignal },
  ): Promise<string>;
}

export interface LocalDeps {
  config(): Promise<AiConfig>;
  fetch: typeof fetch;
  /** Is the built-in model downloaded and chosen? */
  builtinReady(): Promise<boolean>;
  /** Loads it if needed; false = could not. */
  builtinLoad(): Promise<boolean>;
  generate(prompt: string, maxTokens: number, signal?: AbortSignal): Promise<string>;
  builtinTemplate(): ReturnType<typeof findModelByFile>;
}

export function defaultLocalDeps(): LocalDeps {
  return {
    config: () => loadAiConfig(),
    fetch: (input, init) => getPlatform().fetch(input, init),
    async builtinReady() {
      const service = getPlatform().localModel;
      if (!service.supported) return false;
      await useLocalModel.getState().refresh();
      const { status } = useLocalModel.getState();
      const prefs = getLocalPrefs();
      return Boolean(
        prefs.file &&
        status &&
        !status.unavailable &&
        status.models.some((m) => m.file === prefs.file) &&
        findModelByFile(prefs.file),
      );
    },
    builtinLoad: ensureLoaded,
    async generate(prompt, maxTokens, signal) {
      const result = await getPlatform().localModel.generate({ prompt, maxTokens }, { signal });
      return result.text;
    },
    builtinTemplate: () => findModelByFile(getLocalPrefs().file),
  };
}

/** A `fetch` that only talks to this machine and never follows a redirect. */
export function loopbackOnly(inner: typeof fetch): typeof fetch {
  return (input, init) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let host: string;
    try {
      host = new URL(href).hostname;
    } catch {
      throw new LocalOnlyError('remote-host');
    }
    if (!isLoopbackHost(host)) throw new LocalOnlyError('remote-host');
    return inner(input, { ...init, redirect: 'error' });
  };
}

/**
 * The local model to use right now, or `undefined`. The built-in model comes first (nothing leaves the
 * process at all), then an Ollama entry on a loopback address. Cloud providers are never looked at.
 */
export async function findLocalMailModel(
  deps: LocalDeps = defaultLocalDeps(),
): Promise<LocalMailModel | undefined> {
  if (await deps.builtinReady()) {
    const entry = deps.builtinTemplate();
    if (entry)
      return {
        source: 'built-in',
        model: entry.file,
        async complete(system, user, opts) {
          if (!(await deps.builtinLoad())) throw new LocalOnlyError('no-model');
          return (
            await deps.generate(
              formatChat(entry.template, system, user),
              opts?.maxTokens ?? 400,
              opts?.signal,
            )
          ).trim();
        },
      };
  }
  const config = await deps.config().catch(() => undefined);
  const ollama = config?.providers.find((p) => {
    if (p.kind !== 'ollama' || p.tier !== 'local' || !isEntryUsable(p)) return false;
    try {
      return isLoopbackHost(new URL(p.baseUrl.trim()).hostname);
    } catch {
      return false;
    }
  });
  if (!ollama) return undefined;
  const provider = createOllamaProvider({
    id: ollama.id,
    baseUrl: ollama.baseUrl.trim(),
    model: ollama.model.trim(),
    fetch: loopbackOnly(deps.fetch),
  });
  return {
    source: 'ollama',
    model: provider.model,
    async complete(system, user, opts) {
      const result = await provider.complete({
        system,
        user,
        tools: [],
        maxTokens: opts?.maxTokens ?? 400,
        signal: opts?.signal,
      });
      return result.text.trim();
    },
  };
}
