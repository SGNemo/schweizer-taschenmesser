import { describe, expect, it, vi } from 'vitest';
import { createOpenAiCompatibleProvider, extractJsonObject } from './openai';
import { AiError, type CompletionRequest } from './types';

const TOOLS = [
  {
    name: 'run_query',
    description: 'list entries',
    input_schema: { type: 'object', properties: { module: { type: 'string' } } },
  },
];
const req = (over: Partial<CompletionRequest> = {}): CompletionRequest => ({
  system: 'SYSTEM',
  user: 'USER',
  tools: TOOLS,
  ...over,
});

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

function provider(
  respond: (url: string, init: RequestInit) => Response | Promise<Response>,
  opts: Partial<Parameters<typeof createOpenAiCompatibleProvider>[0]> = {},
) {
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    respond(String(input), init ?? {}),
  );
  return {
    fetchFn,
    p: createOpenAiCompatibleProvider({
      id: 'groq',
      baseUrl: 'https://api.example.com/v1/',
      model: 'llama-x',
      apiKey: 'gsk-test',
      fetch: fetchFn as unknown as typeof fetch,
      ...opts,
    }),
  };
}

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof AiError ? e.code : String(e);
  }
};

/** Fixtures in the shape real servers answer with. */
const toolCallAnswer = (args: unknown) => ({
  id: 'chatcmpl-1',
  object: 'chat.completion',
  model: 'llama-x-0324',
  choices: [
    {
      index: 0,
      finish_reason: 'tool_calls',
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'call_1', type: 'function', function: { name: 'run_query', arguments: args } },
        ],
      },
    },
  ],
  usage: { prompt_tokens: 321, completion_tokens: 17, total_tokens: 338 },
});

describe('OpenAI-compatible adapter: request', () => {
  it('posts to {base}/chat/completions with bearer key, tools and only system + user', async () => {
    const { p, fetchFn } = provider(() => json(toolCallAnswer('{"module":"finance"}')));
    await p.complete(req());
    const [url, init] = fetchFn.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ authorization: 'Bearer gsk-test' });
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: 'llama-x',
      max_tokens: 1024,
      tool_choice: 'auto',
      messages: [
        { role: 'system', content: 'SYSTEM' },
        { role: 'user', content: 'USER' },
      ],
      tools: [
        { type: 'function', function: { name: 'run_query', parameters: TOOLS[0]!.input_schema } },
      ],
    });
    expect(Object.keys(body).sort()).toEqual(
      ['max_tokens', 'messages', 'model', 'tool_choice', 'tools'].sort(),
    );
    expect(JSON.stringify(body)).not.toContain('gsk-test'); // the key only travels in the header
  });

  it('uses max_completion_tokens where the API wants it, honours maxTokens, omits empty tools', async () => {
    const { p, fetchFn } = provider(() => json({ choices: [{ message: { content: 'ok' } }] }), {
      maxTokensParam: 'max_completion_tokens',
    });
    await p.complete(req({ tools: [], maxTokens: 16 }));
    const body = JSON.parse((fetchFn.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.max_completion_tokens).toBe(16);
    expect(body).not.toHaveProperty('max_tokens');
    expect(body).not.toHaveProperty('tools');
    expect(body).not.toHaveProperty('tool_choice');
  });

  it('sends no Authorization header for keyless servers', async () => {
    const { p, fetchFn } = provider(() => json({ choices: [{ message: { content: 'ok' } }] }), {
      apiKey: '',
    });
    await p.complete(req());
    expect((fetchFn.mock.calls[0]![1] as RequestInit).headers).not.toHaveProperty('authorization');
  });

  it('refuses to run without a base URL or model', async () => {
    expect(await code(provider(() => json({}), { baseUrl: '' }).p.complete(req()))).toBe(
      'not-configured',
    );
    expect(await code(provider(() => json({}), { model: '' }).p.complete(req()))).toBe(
      'not-configured',
    );
  });
});

describe('OpenAI-compatible adapter: answers', () => {
  it('parses a native tool call (arguments as JSON string) with usage and model', async () => {
    const { p } = provider(() =>
      json(toolCallAnswer('{"module":"finance","collection":"transaction"}')),
    );
    expect(await p.complete(req())).toEqual({
      toolCalls: [{ name: 'run_query', input: { module: 'finance', collection: 'transaction' } }],
      text: '',
      usage: { inputTokens: 321, outputTokens: 17 },
      model: 'llama-x-0324',
    });
  });

  it('accepts arguments delivered as an object and empty arguments', async () => {
    expect(
      (await provider(() => json(toolCallAnswer({ module: 'todos' }))).p.complete(req())).toolCalls,
    ).toEqual([{ name: 'run_query', input: { module: 'todos' } }]);
    expect((await provider(() => json(toolCallAnswer(''))).p.complete(req())).toolCalls).toEqual([
      { name: 'run_query', input: {} },
    ]);
  });

  it('returns plain text answers (string and part-array content)', async () => {
    expect(
      (
        await provider(() =>
          json({ choices: [{ message: { content: ' Dazu habe ich nichts. ' } }] }),
        ).p.complete(req())
      ).text,
    ).toBe('Dazu habe ich nichts.');
    expect(
      (
        await provider(() =>
          json({
            choices: [{ message: { content: [{ type: 'text', text: 'a' }, { text: 'b' }] } }],
          }),
        ).p.complete(req())
      ).text,
    ).toBe('ab');
  });

  it('treats missing usage as zero tokens and falls back to the configured model name', async () => {
    const res = await provider(() => json({ choices: [{ message: { content: 'x' } }] })).p.complete(
      req(),
    );
    expect(res).toMatchObject({ usage: { inputTokens: 0, outputTokens: 0 }, model: 'llama-x' });
  });

  it('maps a refusal', async () => {
    const answer = {
      choices: [{ message: { content: null, refusal: 'I cannot help with that.' } }],
    };
    expect(await code(provider(() => json(answer)).p.complete(req()))).toBe('refusal');
  });

  it.each([
    ['tool arguments that are not JSON', toolCallAnswer('{"module": ')],
    ['no choices', { choices: [] }],
    ['a body without choices', { error: 'weird' }],
    ['choices of the wrong type', { choices: 'nope' }],
    ['a message without object', { choices: [{ message: 'hello' }] }],
    [
      'tool_calls without a function name',
      { choices: [{ message: { tool_calls: [{ function: {} }] } }] },
    ],
  ])('flags %s as invalid-response', async (_name, body) => {
    expect(await code(provider(() => json(body)).p.complete(req()))).toBe('invalid-response');
  });

  it('flags a non-JSON body as invalid-response', async () => {
    expect(await code(provider(() => new Response('<html>oops</html>')).p.complete(req()))).toBe(
      'invalid-response',
    );
  });
});

describe('OpenAI-compatible adapter: errors', () => {
  const status = (
    s: number,
    body: unknown = { error: { message: 'boom' } },
    headers?: HeadersInit,
  ) =>
    provider(() =>
      json(body, { status: s, headers: { 'content-type': 'application/json', ...headers } }),
    );

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate-limit'],
    [500, 'server'],
    [503, 'server'],
    [408, 'network'],
    [400, 'bad-request'],
    [404, 'bad-request'],
    [422, 'bad-request'],
  ])('HTTP %i → %s', async (s, expected) => {
    expect(await code(status(s).p.complete(req()))).toBe(expected);
  });

  it('carries the provider message (truncated) and reads Retry-After in seconds or as a date', async () => {
    const seconds = await status(429, { error: { message: 'slow down' } }, { 'retry-after': '42' })
      .p.complete(req())
      .catch((e: AiError) => e);
    expect(seconds).toMatchObject({ code: 'rate-limit', retryAfterMs: 42_000 });
    expect((seconds as AiError).message).toContain('slow down');

    const inOneMinute = new Date(Date.now() + 60_000).toUTCString();
    const dated = await status(429, {}, { 'retry-after': inOneMinute })
      .p.complete(req())
      .catch((e: AiError) => e);
    expect((dated as AiError).retryAfterMs).toBeGreaterThan(50_000);
    expect((dated as AiError).retryAfterMs).toBeLessThanOrEqual(60_000);

    const long = await status(500, { error: 'x'.repeat(1000) })
      .p.complete(req())
      .catch((e: AiError) => e);
    expect((long as AiError).message.length).toBeLessThan(260);
  });

  it('survives an error response without a JSON body', async () => {
    expect(
      await code(provider(() => new Response('gateway', { status: 502 })).p.complete(req())),
    ).toBe('server');
  });

  it('maps network failures and aborts', async () => {
    expect(
      await code(
        provider(() => {
          throw new TypeError('Failed to fetch');
        }).p.complete(req()),
      ),
    ).toBe('network');
    const ctl = new AbortController();
    ctl.abort();
    expect(
      await code(
        provider(() => {
          throw new DOMException('aborted', 'AbortError');
        }).p.complete(req({ signal: ctl.signal })),
      ),
    ).toBe('aborted');
  });
});

describe('OpenAI-compatible adapter: JSON tool mode (small / free models)', () => {
  const jsonMode = (content: string) =>
    provider(() => json({ choices: [{ message: { content } }] }), { toolMode: 'json' });

  it('describes the tools in the prompt instead of sending them, and parses the JSON answer', async () => {
    const { p, fetchFn } = jsonMode('{"tool":"run_query","input":{"module":"todos"}}');
    const res = await p.complete(req());
    expect(res.toolCalls).toEqual([{ name: 'run_query', input: { module: 'todos' } }]);
    const body = JSON.parse((fetchFn.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).not.toHaveProperty('tools');
    expect(body.messages[0].content).toContain('SYSTEM');
    expect(body.messages[0].content).toContain('"name":"run_query"');
    expect(body.messages[0].content).toContain('ONE JSON object');
  });

  it('finds the JSON inside code fences or prose', async () => {
    for (const content of [
      '```json\n{"tool":"run_query","input":{"module":"x"}}\n```',
      'Klar! {"tool":"run_query","input":{"module":"x"}} Viel Erfolg.',
    ]) {
      expect((await jsonMode(content).p.complete(req())).toolCalls).toEqual([
        { name: 'run_query', input: { module: 'x' } },
      ]);
    }
  });

  it('passes plain prose on as text, but flags broken or empty JSON attempts', async () => {
    expect((await jsonMode('Dazu habe ich keine Antwort.').p.complete(req())).text).toBe(
      'Dazu habe ich keine Antwort.',
    );
    for (const content of [
      '{"tool": "run_query", "input": ',
      '{"answer": 42}',
      '',
      '{"tool":"x","input":"not an object"}',
    ]) {
      expect(await code(jsonMode(content).p.complete(req())), content).toBe('invalid-response');
    }
  });

  it('does not change the request when no tools are given (connection test)', async () => {
    const { p, fetchFn } = jsonMode('ok');
    await p.complete(req({ tools: [] }));
    const body = JSON.parse((fetchFn.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.messages[0].content).toBe('SYSTEM');
  });

  it('extractJsonObject tolerates surrounding text and rejects garbage', () => {
    expect(extractJsonObject('x {"a":1} y')).toEqual({ a: 1 });
    expect(extractJsonObject('no json here')).toBeUndefined();
    expect(extractJsonObject('{ broken')).toBeUndefined();
  });
});
