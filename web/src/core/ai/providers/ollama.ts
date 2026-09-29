/**
 * Local Ollama server (`/api/chat` with tools). The browser may only reach it when Ollama runs
 * with `OLLAMA_ORIGINS` including this app's origin.
 */
import { getPlatform } from '@/core/platform';
import { AiError, type AiProvider, type CompletionRequest, type CompletionResult } from './types';

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5:7b';
const TIMEOUT_MS = 120_000;

export interface OllamaOptions {
  baseUrl?: string;
  model?: string;
  fetch?: typeof fetch;
}

interface OllamaResponse {
  model?: string;
  message?: {
    content?: string;
    tool_calls?: { function?: { name?: string; arguments?: unknown } }[];
  };
  prompt_eval_count?: number;
  eval_count?: number;
}

export function createOllamaProvider(opts: OllamaOptions = {}): AiProvider {
  const model = opts.model || DEFAULT_OLLAMA_MODEL;
  const base = (opts.baseUrl || DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
  const doFetch = opts.fetch ?? ((input, init) => getPlatform().fetch(input, init));
  return {
    id: 'ollama',
    model,
    async complete(req: CompletionRequest): Promise<CompletionResult> {
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
      let res: Response;
      try {
        res = await doFetch(`${base}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal,
          body: JSON.stringify({
            model,
            stream: false,
            messages: [
              { role: 'system', content: req.system },
              { role: 'user', content: req.user },
            ],
            tools: req.tools.map((t) => ({
              type: 'function',
              function: { name: t.name, description: t.description, parameters: t.input_schema },
            })),
          }),
        });
      } catch (e) {
        if (req.signal?.aborted) throw new AiError('aborted');
        throw new AiError('unavailable', e instanceof Error ? e.message : String(e));
      }
      if (!res.ok) {
        throw new AiError(res.status >= 500 ? 'server' : 'bad-request', `HTTP ${res.status}`);
      }
      const body = (await res.json()) as OllamaResponse;
      const toolCalls = (body.message?.tool_calls ?? []).flatMap((c) => {
        const name = c.function?.name;
        if (!name) return [];
        let input = c.function?.arguments;
        if (typeof input === 'string') {
          try {
            input = JSON.parse(input) as unknown;
          } catch {
            return [];
          }
        }
        return [{ name, input }];
      });
      return {
        toolCalls,
        text: (body.message?.content ?? '').trim(),
        usage: { inputTokens: body.prompt_eval_count ?? 0, outputTokens: body.eval_count ?? 0 },
        model: body.model || model,
      };
    },
  };
}
