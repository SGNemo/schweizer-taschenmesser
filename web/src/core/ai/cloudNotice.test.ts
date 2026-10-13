import { describe, expect, it, vi } from 'vitest';
import { createProviderFor, type ProviderEntry } from './config';
import * as notices from '@/core/legal/notices';

const entry = (kind: ProviderEntry['kind']): ProviderEntry =>
  ({
    id: 'p',
    kind,
    model: 'm',
    baseUrl: 'http://localhost:11434',
    keySet: true,
    keyRequired: kind !== 'ollama',
  }) as ProviderEntry;

const ok = () =>
  Promise.resolve(
    new Response(
      JSON.stringify({ choices: [{ message: { content: 'ok' } }], message: { content: 'ok' } }),
      {
        headers: { 'content-type': 'application/json' },
      },
    ),
  );

describe('third-party notice before the first cloud request', () => {
  it('is required before an OpenAI-compatible request, in front of the network call', async () => {
    const order: string[] = [];
    vi.spyOn(notices, 'requireNotice').mockImplementation(async () => void order.push('notice'));
    const p = createProviderFor(
      { ...entry('openai-compatible'), baseUrl: 'https://api.example.com/v1' },
      'k',
      () => {
        order.push('fetch');
        return ok();
      },
    );
    await p.complete({ system: 's', user: 'u', tools: [] }).catch(() => undefined);
    expect(order.slice(0, 2)).toEqual(['notice', 'fetch']);
  });

  it('is not required for Ollama (local)', async () => {
    const spy = vi.spyOn(notices, 'requireNotice').mockClear();
    const p = createProviderFor(entry('ollama'), '', () => ok());
    await p.complete({ system: 's', user: 'u', tools: [] }).catch(() => undefined);
    expect(spy).not.toHaveBeenCalled();
  });
});
