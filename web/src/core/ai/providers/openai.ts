/**
 * Adapter for OpenAI-compatible chat APIs (`POST {base}/chat/completions`): OpenAI, Google Gemini's
 * compatibility endpoint, Groq, OpenRouter, Mistral and any self-hosted server that speaks it. The
 * response is validated with Zod; anything unexpected becomes `invalid-response`, which lets the router
 * fall back to the next provider instead of guessing.
 *
 * `toolMode: 'json'` is for small or free models without native tool calling: the tools are described
 * in the prompt and the model answers with `{"tool": "...", "input": {...}}`.
 */
import { z } from 'zod';
import { getPlatform } from '@/core/platform';
import { retryAfterMs } from './claude';
import { AiError, type AiProvider, type CompletionRequest, type CompletionResult } from './types';

const TIMEOUT_MS = 30_000;
const MAX_TOKENS = 1024;

export interface OpenAiCompatibleOptions {
  /** Id of the configured provider entry. */
  id: string;
  baseUrl: string;
  model: string;
  /** Empty for keyless self-hosted servers. */
  apiKey?: string;
  toolMode?: 'native' | 'json';
  maxTokensParam?: 'max_tokens' | 'max_completion_tokens';
  fetch?: typeof fetch;
}

const contentSchema = z.union([
  z.string(),
  z.null(),
  z.array(z.object({ type: z.string().optional(), text: z.string().optional() })),
]);

const responseSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({
          content: contentSchema.optional(),
          refusal: z.string().nullish(),
          tool_calls: z
            .array(
              z.object({
                function: z.object({
                  name: z.string(),
                  arguments: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
                }),
              }),
            )
            .nullish(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
    })
    .nullish(),
});

const errorBodySchema = z.object({
  error: z.union([z.string(), z.object({ message: z.string().optional() })]).optional(),
});

const textOf = (content: z.infer<typeof contentSchema> | undefined): string =>
  typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map((c) => c.text ?? '').join('')
      : '';

/** First `{ … }` object in the text (models like to wrap JSON in prose or code fences). */
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown;
  } catch {
    return undefined;
  }
}

const jsonToolAnswer = z.object({ tool: z.string(), input: z.record(z.string(), z.unknown()) });

function jsonModeSystem(req: CompletionRequest): string {
  const tools = req.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
  return `${req.system}

You cannot call tools directly. Answer with ONE JSON object and nothing else: {"tool": "<tool name>", "input": {<tool input>}}. Available tools:
${JSON.stringify(tools)}`;
}

function mapStatus(res: Response, detail: string): AiError {
  const { status } = res;
  if (status === 401 || status === 403) return new AiError('auth', detail);
  if (status === 429) {
    return new AiError('rate-limit', detail, { retryAfterMs: retryAfterMs(res.headers) });
  }
  if (status >= 500) return new AiError('server', detail);
  if (status === 408) return new AiError('network', detail);
  return new AiError('bad-request', detail);
}

export function createOpenAiCompatibleProvider(opts: OpenAiCompatibleOptions): AiProvider {
  const base = opts.baseUrl.replace(/\/+$/, '');
  const doFetch = opts.fetch ?? ((input, init) => getPlatform().fetch(input, init));
  const toolMode = opts.toolMode ?? 'native';
  return {
    id: opts.id,
    model: opts.model,
    async complete(req: CompletionRequest): Promise<CompletionResult> {
      if (!base || !opts.model) throw new AiError('not-configured');
      const timeout = AbortSignal.timeout(TIMEOUT_MS);
      const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
      const useTools = req.tools.length > 0;
      const body: Record<string, unknown> = {
        model: opts.model,
        [opts.maxTokensParam ?? 'max_tokens']: req.maxTokens ?? MAX_TOKENS,
        messages: [
          {
            role: 'system',
            content: useTools && toolMode === 'json' ? jsonModeSystem(req) : req.system,
          },
          { role: 'user', content: req.user },
        ],
      };
      if (useTools && toolMode === 'native') {
        body.tools = req.tools.map((t) => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.input_schema },
        }));
        body.tool_choice = 'auto';
      }

      let res: Response;
      try {
        res = await doFetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}),
          },
          signal,
          body: JSON.stringify(body),
        });
      } catch (e) {
        if (req.signal?.aborted) throw new AiError('aborted');
        throw new AiError('network', e instanceof Error ? e.message : String(e));
      }

      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const parsed = errorBodySchema.safeParse(await res.json());
          const err = parsed.success ? parsed.data.error : undefined;
          const message = typeof err === 'string' ? err : err?.message;
          if (message) detail += `: ${message.slice(0, 200)}`;
        } catch {
          // no JSON body – the status code says enough
        }
        throw mapStatus(res, detail);
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        throw new AiError('invalid-response', 'answer is not JSON');
      }
      const parsed = responseSchema.safeParse(json);
      if (!parsed.success) throw new AiError('invalid-response', 'unexpected answer format');
      const { message } = parsed.data.choices[0]!;
      if (message.refusal) throw new AiError('refusal');

      const usage = {
        inputTokens: parsed.data.usage?.prompt_tokens ?? 0,
        outputTokens: parsed.data.usage?.completion_tokens ?? 0,
      };
      const model = parsed.data.model || opts.model;
      const content = textOf(message.content).trim();

      // Native tool calls.
      const rawCalls = message.tool_calls ?? [];
      if (rawCalls.length > 0) {
        const toolCalls: CompletionResult['toolCalls'] = [];
        for (const call of rawCalls) {
          const args = call.function.arguments;
          let input: unknown = args ?? {};
          if (typeof args === 'string') {
            try {
              input = args.trim() ? (JSON.parse(args) as unknown) : {};
            } catch {
              continue; // unparseable arguments: not a usable call
            }
          }
          toolCalls.push({ name: call.function.name, input });
        }
        if (toolCalls.length === 0)
          throw new AiError('invalid-response', 'tool arguments are not JSON');
        return { toolCalls, text: content, usage, model };
      }

      // JSON mode: the tool call is in the text.
      if (useTools && toolMode === 'json') {
        const answer = jsonToolAnswer.safeParse(extractJsonObject(content));
        if (answer.success) {
          return {
            toolCalls: [{ name: answer.data.tool, input: answer.data.input }],
            text: '',
            usage,
            model,
          };
        }
        // Empty, or a JSON attempt that is not a tool call: unusable. Plain prose is passed on as text.
        if (content === '' || content.includes('{')) {
          throw new AiError('invalid-response', 'no usable tool call in the answer');
        }
      }
      return { toolCalls: [], text: content, usage, model };
    },
  };
}
