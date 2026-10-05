// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { writeLocalPrefs } from '@/core/ai/local/prefs';
import { useLocalModel } from '@/core/ai/local/state';
import { LOCAL_MODELS } from '@/core/ai/local/catalogue';
import type { AiProvider, CompletionRequest } from '@/core/ai/providers/types';
import { setPlatform } from '@/core/platform';
import { createFakeLocalModel } from '@/core/platform/fakeLocalModel';
import { createWebPlatform } from '@/core/platform/web';
import {
  addQuestion,
  deleteThread,
  dropLastAnswer,
  editQuestion,
  generateReply,
  messagesOf,
} from '../engine';
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

function provider(answer = 'Antwort **fett**'): AiProvider & { seen: CompletionRequest[] } {
  const seen: CompletionRequest[] = [];
  return {
    id: 'router',
    model: 'test-model',
    seen,
    async complete(req) {
      seen.push(req);
      return {
        toolCalls: [],
        text: answer,
        usage: { inputTokens: 40, outputTokens: 10 },
        model: 'test-model',
        providerId: 'p1',
        costUsd: 0.001,
      };
    },
  };
}

beforeEach(async () => {
  for (const name of ['chat_thread', 'chat_message', '_aiUsage']) await db.table(name).clear();
  localStorage.clear();
});
afterEach(() => setPlatform(undefined));

describe('chat engine', () => {
  it('answers through the router with history, stores the answer and counts usage', async () => {
    const thread = await threadRepo.create(base);
    await addQuestion(thread.id, 'Erste Frage');
    const p = provider();
    expect((await generateReply(thread.id, { provider: p })).ok).toBe(true);
    await addQuestion(thread.id, 'Zweite Frage');
    await generateReply(thread.id, { provider: p });

    const second = p.seen[1]!;
    expect(second.tools).toEqual([]);
    expect(second.history?.map((h) => h.role)).toEqual(['user', 'assistant']);
    expect(second.user).toBe('Zweite Frage');

    const stored = await threadRepo.get(thread.id);
    expect(stored?.title).toBe('Erste Frage'); // automatic title from the first message
    expect(stored?.tokensIn).toBe(80);
    expect(stored?.costUsd).toBeCloseTo(0.002);
    const usage = await db.table('_aiUsage').toArray();
    expect(usage.every((u) => u.stage === 'cloud' && u.provider === 'p1')).toBe(true);
    expect((await messagesOf(thread.id)).map((m) => m.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ]);
  });

  it('keeps a renamed title and reports a missing provider without storing anything', async () => {
    const thread = await threadRepo.create({ ...base, title: 'Mein Titel', autoTitle: false });
    await addQuestion(thread.id, 'Hallo');
    const result = await generateReply(thread.id, {});
    expect(result).toEqual({ ok: false, error: 'no-engine' });
    expect(await messagesOf(thread.id)).toHaveLength(1);
    await generateReply(thread.id, { provider: provider() });
    expect((await threadRepo.get(thread.id))?.title).toBe('Mein Titel');
  });

  it('answers with the local model: 0 cost, stage local, no provider involved', async () => {
    const entry = LOCAL_MODELS[0]!;
    const fake = createFakeLocalModel({
      models: [{ file: entry.file, bytes: entry.bytes }],
      answer: () => 'Lokale Antwort',
    });
    setPlatform({ ...createWebPlatform(), localModel: fake });
    writeLocalPrefs({ file: entry.file, first: true, autoLoad: true });
    await useLocalModel.getState().refresh();
    const thread = await threadRepo.create({ ...base, engine: 'local' });
    await addQuestion(thread.id, 'Hallo lokal');
    const result = await generateReply(thread.id, {});
    expect(result.ok && result.message.stage).toBe('local');
    expect(fake.requests[0]!.prompt).toContain('Hallo lokal');
    expect(fake.requests[0]!.grammar).toBeUndefined();
    const usage = await db.table('_aiUsage').toArray();
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ stage: 'local', provider: 'local-model' });
    expect((await threadRepo.get(thread.id))?.costUsd).toBe(0);
  });

  it('local engine without a ready model fails cleanly', async () => {
    setPlatform({ ...createWebPlatform(), localModel: createFakeLocalModel() });
    const thread = await threadRepo.create({ ...base, engine: 'local' });
    await addQuestion(thread.id, 'Hallo');
    expect(await generateReply(thread.id, {})).toEqual({ ok: false, error: 'local-unavailable' });
  });

  it('regenerate, edit and delete clean up the conversation', async () => {
    const thread = await threadRepo.create(base);
    const q1 = await addQuestion(thread.id, 'Eins');
    await generateReply(thread.id, { provider: provider('A1') });
    await addQuestion(thread.id, 'Zwei');
    await generateReply(thread.id, { provider: provider('A2') });

    await dropLastAnswer(thread.id);
    expect((await messagesOf(thread.id)).at(-1)?.content).toBe('Zwei');

    await editQuestion(thread.id, q1.id, 'Eins geändert', 1234);
    const after = await messagesOf(thread.id);
    expect(after.map((m) => m.content)).toEqual(['Eins geändert']);
    expect(after[0]!.editedAt).toBe(1234);

    await deleteThread(thread.id);
    expect(await messagesOf(thread.id)).toEqual([]);
    expect(await threadRepo.get(thread.id)).toBeUndefined();
    expect((await messageRepo.active().toArray()).length).toBe(0);
  });
});
