import { describe, expect, it, vi } from 'vitest';
import { createClaudeProvider } from './claude';
import { AiError, type CompletionRequest } from './types';

const req: CompletionRequest = {
  system: 'SYSTEM',
  user: 'Heute: 2026-09-29\nFrage: Was steht morgen an?',
  tools: [
    {
      name: 'show_agenda',
      description: 'Agenda',
      input_schema: { type: 'object', properties: {} },
    },
  ],
};

const message = (over: Record<string, unknown> = {}) => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-4-5-20251001',
  stop_reason: 'tool_use',
  stop_sequence: null,
  content: [{ type: 'tool_use', id: 'tu_1', name: 'show_agenda', input: { relative: 'tomorrow' } }],
  usage: { input_tokens: 412, output_tokens: 23 },
  ...over,
});

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const provider = (fetchImpl: typeof fetch) =>
  createClaudeProvider({ apiKey: 'sk-ant-test', fetch: fetchImpl, maxRetries: 0 });

describe('Claude provider', () => {
  it('sends only system, question and tool definitions, straight from the browser', async () => {
    const fetchMock = vi.fn(async () => json(message()));
    const res = await provider(fetchMock as unknown as typeof fetch).complete(req);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = new Headers(init.headers);
    expect(headers.get('x-api-key')).toBe('sk-ant-test');
    expect(headers.get('anthropic-dangerous-direct-browser-access')).toBe('true');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: 'SYSTEM',
      messages: [{ role: 'user', content: req.user }],
      tools: [{ name: 'show_agenda', description: 'Agenda' }],
    });
    // Newer models reject forced tool use / sampling parameters; none may be sent.
    expect(body).not.toHaveProperty('tool_choice');
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('thinking');

    expect(res).toEqual({
      toolCalls: [{ name: 'show_agenda', input: { relative: 'tomorrow' } }],
      text: '',
      usage: { inputTokens: 412, outputTokens: 23 },
      model: 'claude-haiku-4-5-20251001',
    });
  });

  it('uses the configured model and returns plain text answers', async () => {
    const fetchMock = vi.fn(async () =>
      json(
        message({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: ' Das kann ich nicht. ' }],
        }),
      ),
    );
    const p = createClaudeProvider({
      apiKey: 'k',
      model: 'claude-sonnet-5-5',
      fetch: fetchMock as unknown as typeof fetch,
      maxRetries: 0,
    });
    const res = await p.complete(req);
    expect(
      JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
        .model,
    ).toBe('claude-sonnet-5-5');
    expect(res.text).toBe('Das kann ich nicht.');
    expect(res.toolCalls).toEqual([]);
  });

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate-limit'],
    [400, 'bad-request'],
    [500, 'server'],
  ])('maps HTTP %i to %s', async (status, code) => {
    const fetchMock = vi.fn(async () =>
      json({ type: 'error', error: { type: 'x', message: 'nope' } }, status),
    );
    await expect(
      provider(fetchMock as unknown as typeof fetch).complete(req),
    ).rejects.toMatchObject({ name: 'AiError', code });
  });

  it('maps connection failures to "network"', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(
      provider(fetchMock as unknown as typeof fetch).complete(req),
    ).rejects.toMatchObject({ code: 'network' });
  });

  it('reports refusals', async () => {
    const fetchMock = vi.fn(async () => json(message({ stop_reason: 'refusal', content: [] })));
    await expect(
      provider(fetchMock as unknown as typeof fetch).complete(req),
    ).rejects.toMatchObject({ code: 'refusal' });
  });

  it('can be aborted', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const pending = provider(fetchMock as unknown as typeof fetch).complete({
      ...req,
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'aborted' });
  });

  it('refuses to run without a key', async () => {
    const fetchMock = vi.fn();
    const p = createClaudeProvider({ apiKey: '', fetch: fetchMock as unknown as typeof fetch });
    await expect(p.complete(req)).rejects.toBeInstanceOf(AiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
