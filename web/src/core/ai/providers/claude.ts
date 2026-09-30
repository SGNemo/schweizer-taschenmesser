/**
 * Claude via the official SDK, called straight from the browser (the key stays on this device).
 * The SDK is imported lazily so it never weighs on the main bundle.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { AiError, type AiProvider, type CompletionRequest, type CompletionResult } from './types';

export const DEFAULT_CLAUDE_MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 30_000;

export interface ClaudeOptions {
  /** Id of the configured provider entry (default `claude`). */
  id?: string;
  apiKey: string;
  model?: string;
  /** Injectable for tests. */
  fetch?: typeof fetch;
  /** SDK retries on 429/5xx/connection errors (default 1). */
  maxRetries?: number;
}

export function createClaudeProvider(opts: ClaudeOptions): AiProvider {
  const model = opts.model || DEFAULT_CLAUDE_MODEL;
  return {
    id: opts.id ?? 'claude',
    model,
    async complete(req: CompletionRequest): Promise<CompletionResult> {
      if (!opts.apiKey) throw new AiError('not-configured');
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({
        apiKey: opts.apiKey,
        dangerouslyAllowBrowser: true,
        fetch: opts.fetch,
        timeout: TIMEOUT_MS,
        maxRetries: opts.maxRetries ?? 1,
      });
      try {
        const res = await client.messages.create(
          {
            model,
            max_tokens: req.maxTokens ?? MAX_TOKENS,
            system: req.system,
            // `auto` (the default): forcing a tool is rejected by newer models, so the
            // system prompt asks for exactly one tool call instead.
            ...(req.tools.length > 0
              ? {
                  tools: req.tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    input_schema: t.input_schema as { type: 'object' },
                  })),
                }
              : {}),
            messages: [{ role: 'user', content: req.user }],
          },
          { signal: req.signal },
        );
        if (res.stop_reason === 'refusal') throw new AiError('refusal');
        const toolCalls: CompletionResult['toolCalls'] = [];
        let text = '';
        for (const block of res.content) {
          if (block.type === 'tool_use') toolCalls.push({ name: block.name, input: block.input });
          else if (block.type === 'text') text += block.text;
        }
        return {
          toolCalls,
          text: text.trim(),
          usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
          model: res.model || model,
        };
      } catch (e) {
        throw mapClaudeError(e, Anthropic);
      }
    },
  };
}

function mapClaudeError(e: unknown, sdk: typeof Anthropic): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof sdk.APIUserAbortError) return new AiError('aborted');
  if (e instanceof sdk.AuthenticationError || e instanceof sdk.PermissionDeniedError)
    return new AiError('auth');
  if (e instanceof sdk.RateLimitError) {
    return new AiError('rate-limit', undefined, { retryAfterMs: retryAfterMs(e.headers) });
  }
  if (e instanceof sdk.APIConnectionError) return new AiError('network');
  if (e instanceof sdk.BadRequestError) return new AiError('bad-request', String(e.message));
  if (e instanceof sdk.APIError) return new AiError('server', String(e.message));
  return new AiError('network', e instanceof Error ? e.message : String(e));
}

/** `retry-after` (seconds or an HTTP date) → ms. */
export function retryAfterMs(
  headers: { get(name: string): string | null } | undefined,
): number | undefined {
  const raw = headers?.get('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds) * 1000;
  const at = Date.parse(raw);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
}
