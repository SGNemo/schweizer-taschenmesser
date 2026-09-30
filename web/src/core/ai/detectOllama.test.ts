import { describe, expect, it } from 'vitest';
import { detectOllama } from './detectOllama';

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('detectOllama', () => {
  it('finds a local server and lists its models', async () => {
    const seen: string[] = [];
    const fetchFn = ((url: string) => {
      seen.push(url);
      return json({ models: [{ name: 'qwen2.5:7b' }, { name: 'llama3' }, {}] });
    }) as unknown as typeof fetch;
    expect(await detectOllama(fetchFn)).toEqual({ found: true, models: ['qwen2.5:7b', 'llama3'] });
    expect(seen).toEqual(['http://localhost:11434/api/tags']);
  });

  it('is not found when the server errors, is unreachable or hangs', async () => {
    expect(await detectOllama((() => json({}, 500)) as unknown as typeof fetch)).toEqual({
      found: false,
    });
    expect(
      await detectOllama((() => Promise.reject(new Error('refused'))) as unknown as typeof fetch),
    ).toEqual({
      found: false,
    });
    const hang = ((_u: string, init?: RequestInit) =>
      new Promise((_r, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
      )) as unknown as typeof fetch;
    expect(await detectOllama(hang, 20)).toEqual({ found: false });
  });
});
