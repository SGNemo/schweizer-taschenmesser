// @vitest-environment jsdom
/**
 * AI1 (launch review 2026-11): a chat stays with the provider it first went to. The engine pins the
 * thread to that provider, sends every later turn pinned, and each answer names its provider.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import {
  AiError,
  type AiProvider,
  type CompletionRequest,
  type CompletionResult,
} from '@/core/ai/providers/types';
import { addQuestion, chooseProvider, generateReply, messagesOf } from '../engine';
import { messageRepo, threadRepo } from '../repo';
import type { Thread } from '../schema';

const base: Thread = {
  title: 'Neuer Chat',
  autoTitle: true,
  pinned: false,
  archived: false,
  engine: 'router',
  contextModules: [],
  tokensIn: 0,
  tokensOut: 0,
  costUsd: 0,
};

type Step = Partial<CompletionResult> | AiError;
function provider(steps: Step[] = []): AiProvider & { seen: CompletionRequest[] } {
  const seen: CompletionRequest[] = [];
  const queue = [...steps];
  return {
    id: 'router',
    model: 'm',
    seen,
    async complete(req) {
      seen.push(req);
      const next = queue.shift() ?? {};
      if (next instanceof AiError) throw next;
      return {
        toolCalls: [],
        text: 'Antwort',
        usage: { inputTokens: 4, outputTokens: 2 },
        model: 'm',
        providerId: 'p1',
        providerLabel: 'Anbieter Eins',
        ...next,
      };
    },
  };
}

beforeEach(async () => {
  for (const name of ['chat_thread', 'chat_message', '_aiUsage']) await db.table(name).clear();
  localStorage.clear();
});

describe('chat engine: provider pin', () => {
  it('pins the thread to the provider that answered and names it on the answer', async () => {
    const thread = await threadRepo.create(base);
    await addQuestion(thread.id, 'Frage', 'Daten: Kontostand 12,00 €');
    const p = provider();
    const first = await generateReply(thread.id, { provider: p });
    expect(first.ok).toBe(true);
    expect(p.seen[0]!.pin).toBeUndefined(); // a new chat may go to the first eligible provider
    const stored = await threadRepo.get(thread.id);
    expect(stored?.providerId).toBe('p1');
    expect(stored?.providerLabel).toBe('Anbieter Eins');
    const [, answer] = await messagesOf(thread.id);
    expect(answer?.providerLabel).toBe('Anbieter Eins');

    await addQuestion(thread.id, 'Noch eine');
    await generateReply(thread.id, { provider: p });
    expect(p.seen[1]!.pin).toEqual({ providerId: 'p1' });
  });

  it('pins to the provider that got the chat even when it failed, so "try again" cannot switch', async () => {
    const thread = await threadRepo.create(base);
    await addQuestion(thread.id, 'Frage', 'Daten');
    const failed = new AiError('server', 'down', {
      attempts: [{ providerId: 'p1', model: 'm', error: 'server' }],
    });
    const p = provider([failed]);
    const result = await generateReply(thread.id, { provider: p });
    expect(result).toMatchObject({ ok: false, error: 'server' });
    expect((await threadRepo.get(thread.id))?.providerId).toBe('p1');
    await generateReply(thread.id, { provider: p });
    expect(p.seen[1]!.pin).toEqual({ providerId: 'p1' });
  });

  it('reports a paused pinned provider calmly, with its name', async () => {
    const thread = await threadRepo.create({ ...base, providerId: 'p1', providerLabel: 'Eins' });
    await addQuestion(thread.id, 'Frage');
    const p = provider([new AiError('provider-paused')]);
    expect(await generateReply(thread.id, { provider: p })).toMatchObject({
      ok: false,
      error: 'provider-paused',
    });
  });

  it('a chat from before the pin with earlier cloud answers stays with the first configured provider', async () => {
    const thread = await threadRepo.create(base);
    await addQuestion(thread.id, 'Alt');
    await messageRepo.create({
      threadId: thread.id,
      role: 'assistant',
      content: 'A',
      stage: 'cloud',
    });
    await addQuestion(thread.id, 'Neu');
    const p = provider();
    await generateReply(thread.id, { provider: p });
    expect(p.seen[0]!.pin).toBe('first-configured');
  });

  it('"Anderen Anbieter wählen" moves the pin only when the user picks one', async () => {
    const thread = await threadRepo.create({ ...base, providerId: 'p1', providerLabel: 'Eins' });
    await chooseProvider(thread.id, { id: 'p2', label: 'Zwei' });
    const stored = await threadRepo.get(thread.id);
    expect(stored).toMatchObject({ providerId: 'p2', providerLabel: 'Zwei' });
    await addQuestion(thread.id, 'Frage');
    const p = provider([{ providerId: 'p2', providerLabel: 'Zwei' }]);
    await generateReply(thread.id, { provider: p });
    expect(p.seen[0]!.pin).toEqual({ providerId: 'p2' });
  });
});
