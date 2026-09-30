import { describe, expect, it, vi } from 'vitest';
import { createOllamaProvider } from './ollama';
import type { CompletionRequest } from './types';

const req: CompletionRequest = {
  system: 'SYSTEM',
  user: 'Frage',
  tools: [
    { name: 'run_query', description: 'Q', input_schema: { type: 'object', properties: {} } },
  ],
};

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('Ollama provider', () => {
  it('posts to /api/chat with tools and parses tool calls and token counts', async () => {
    const fetchMock = vi.fn(async () =>
      reply({
        model: 'qwen2.5:7b',
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            { function: { name: 'run_query', arguments: { module: 'todos', collection: 'task' } } },
          ],
        },
        prompt_eval_count: 300,
        eval_count: 40,
      }),
    );
    const p = createOllamaProvider({
      baseUrl: 'http://localhost:11434/',
      fetch: fetchMock as unknown as typeof fetch,
    });
    const res = await p.complete(req);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/api/chat');
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'qwen2.5:7b',
      stream: false,
      messages: [
        { role: 'system', content: 'SYSTEM' },
        { role: 'user', content: 'Frage' },
      ],
      tools: [{ type: 'function', function: { name: 'run_query', description: 'Q' } }],
    });
    expect(res.toolCalls).toEqual([
      { name: 'run_query', input: { module: 'todos', collection: 'task' } },
    ]);
    expect(res.usage).toEqual({ inputTokens: 300, outputTokens: 40 });
  });

  it('accepts JSON-string arguments and skips broken calls', async () => {
    const fetchMock = vi.fn(async () =>
      reply({
        message: {
          content: 'hm',
          tool_calls: [
            { function: { name: 'show_agenda', arguments: '{"relative":"today"}' } },
            { function: { name: 'show_agenda', arguments: '{oops' } },
            { function: {} },
          ],
        },
      }),
    );
    const res = await createOllamaProvider({
      fetch: fetchMock as unknown as typeof fetch,
    }).complete(req);
    expect(res.toolCalls).toEqual([{ name: 'show_agenda', input: { relative: 'today' } }]);
    expect(res.text).toBe('hm');
    expect(res.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it('reports an unreachable server and HTTP errors', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(
      createOllamaProvider({ fetch: down as unknown as typeof fetch }).complete(req),
    ).rejects.toMatchObject({ code: 'unavailable' });
    const broken = vi.fn(async () => reply({}, 500));
    await expect(
      createOllamaProvider({ fetch: broken as unknown as typeof fetch }).complete(req),
    ).rejects.toMatchObject({ code: 'server' });
    const missing = vi.fn(async () => reply({ error: 'model not found' }, 404));
    await expect(
      createOllamaProvider({ fetch: missing as unknown as typeof fetch }).complete(req),
    ).rejects.toMatchObject({ code: 'bad-request' });
  });
});
