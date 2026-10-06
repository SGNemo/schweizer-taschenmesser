/**
 * Answers for the chat module. Two engines: the built-in local model (0 tokens, offline) and the
 * configured providers through the router (cost counted in the statistics like every other call).
 * Only the conversation of this chat leaves the device – and for a cloud engine only text the
 * user typed plus data they explicitly attached (`context.ts`, shown before sending). The chat
 * never sees the password vault; modules without `aiSchema` do not exist for it.
 */
import { recordAttempts } from '@/core/ai/assistant';
import { findModelByFile } from '@/core/ai/local/catalogue';
import { getLocalPrefs } from '@/core/ai/local/prefs';
import { formatChatTurns } from '@/core/ai/local/prompts/chat';
import { ensureLoaded } from '@/core/ai/local/state';
import { AiError, type AiErrorCode, type AiProvider } from '@/core/ai/providers/types';
import { isAiOn } from '@/core/ai/switch';
import { recordUsage } from '@/core/ai/usage';
import type { Stored } from '@/core/db/types';
import { getPlatform } from '@/core/platform';
import { autoTitle, byTime, toTurns } from './logic';
import { messageRepo, threadRepo } from './repo';
import type { Message } from './schema';

export type ChatErrorCode =
  AiErrorCode | 'no-engine' | 'local-unavailable' | 'no-thread' | 'ai-off';

export type ReplyResult =
  { ok: true; message: Stored<Message> } | { ok: false; error: ChatErrorCode; detail?: string };

export const BASE_SYSTEM =
  'You are a helpful, concise assistant inside the personal organiser app Nemo. Answer in the language of the question (German by default). You cannot see the user\'s data except what is quoted in the question as "Daten aus der App"; never invent entries, amounts or dates. Use Markdown sparingly.';

const MAX_TOKENS_LOCAL = 800;
const MAX_TOKENS_CLOUD = 1024;

export interface ReplyOptions {
  /** The configured providers as a router; undefined = none set up. */
  provider?: AiProvider;
  signal?: AbortSignal;
  /** Pieces of the answer while the local model writes (the cloud answers in one piece). */
  onToken?: (piece: string) => void;
}

/** Messages of a chat in order. */
export async function messagesOf(threadId: string): Promise<Stored<Message>[]> {
  const rows = await messageRepo
    .active()
    .filter((m) => m.threadId === threadId)
    .toArray();
  return rows.sort(byTime);
}

/**
 * Answers the last user message of the chat and stores the answer. A failure stores nothing, so
 * "try again" is the same call. The first user message gives an automatic title.
 */
export async function generateReply(threadId: string, opts: ReplyOptions): Promise<ReplyResult> {
  // "KI abschalten": no model, no provider, no matter which engine the chat has.
  if (!(await isAiOn())) return { ok: false, error: 'ai-off' };
  const thread = await threadRepo.get(threadId);
  if (!thread) return { ok: false, error: 'no-thread' };
  const stored = await messagesOf(threadId);
  const turns = toTurns(stored);
  const last = turns[turns.length - 1];
  if (!last) return { ok: false, error: 'no-engine', detail: 'no question' };
  const system = thread.systemPrompt?.trim()
    ? `${BASE_SYSTEM}\n\n${thread.systemPrompt.trim()}`
    : BASE_SYSTEM;

  let text: string;
  let usage: { inputTokens: number; outputTokens: number };
  let model: string;
  let stage: 'local' | 'cloud';
  let costUsd: number | undefined;

  try {
    if (thread.engine === 'local') {
      const entry = findModelByFile(getLocalPrefs().file);
      if (!entry || !(await ensureLoaded())) {
        return { ok: false, error: 'local-unavailable' };
      }
      const result = await getPlatform().localModel.generate(
        {
          prompt: formatChatTurns(entry.template, system, turns),
          maxTokens: MAX_TOKENS_LOCAL,
        },
        { signal: opts.signal, onToken: opts.onToken },
      );
      if (result.stop === 'cancelled') return { ok: false, error: 'aborted' };
      text = result.text.trim();
      usage = { inputTokens: result.promptTokens, outputTokens: result.generatedTokens };
      model = entry.label;
      stage = 'local';
    } else {
      if (!opts.provider) return { ok: false, error: 'no-engine' };
      const response = await opts.provider.complete({
        system,
        history: turns.slice(0, -1),
        user: last.content,
        tools: [],
        signal: opts.signal,
        maxTokens: MAX_TOKENS_CLOUD,
      });
      await recordAttempts(response.attempts);
      text = response.text.trim();
      usage = response.usage;
      model = response.model;
      stage = 'cloud';
      costUsd = response.costUsd;
      await recordUsage({
        provider: response.providerId ?? opts.provider.id,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheHit: false,
        outcome: 'ok',
        viaFallback: (response.attempts?.length ?? 0) > 0,
        costUsd,
        stage: 'cloud',
      });
    }
  } catch (e) {
    if (e instanceof AiError) {
      await recordAttempts(e.attempts);
      return { ok: false, error: e.code, detail: e.message };
    }
    if (opts.signal?.aborted) return { ok: false, error: 'aborted' };
    return { ok: false, error: 'unavailable', detail: e instanceof Error ? e.message : String(e) };
  }
  if (!text) return { ok: false, error: 'invalid-response' };

  if (stage === 'local') {
    await recordUsage({
      provider: 'local-model',
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheHit: false,
      outcome: 'ok',
      stage: 'local',
    });
  }
  const message = await messageRepo.create({
    threadId,
    role: 'assistant',
    content: text,
    stage,
    model,
    tokensIn: usage.inputTokens,
    tokensOut: usage.outputTokens,
  });
  const first = stored.find((m) => m.role === 'user');
  await threadRepo.update(threadId, {
    tokensIn: thread.tokensIn + usage.inputTokens,
    tokensOut: thread.tokensOut + usage.outputTokens,
    costUsd: thread.costUsd + (costUsd ?? 0),
    ...(thread.autoTitle && first ? { title: autoTitle(first.content) } : {}),
  });
  return { ok: true, message };
}

/** Stores a question (with the data attached to it, as sent) and returns it. */
export async function addQuestion(
  threadId: string,
  content: string,
  context?: string,
): Promise<Stored<Message>> {
  return messageRepo.create({
    threadId,
    role: 'user',
    content: content.trim(),
    ...(context ? { context } : {}),
  });
}

/** "Neu generieren": drops the last answer, the caller asks again. */
export async function dropLastAnswer(threadId: string): Promise<void> {
  const all = await messagesOf(threadId);
  const last = all[all.length - 1];
  if (last?.role === 'assistant') await messageRepo.remove(last.id);
}

/** Edits a question and drops everything after it (the answers no longer fit). */
export async function editQuestion(
  threadId: string,
  messageId: string,
  content: string,
  at: number,
): Promise<void> {
  const all = await messagesOf(threadId);
  const index = all.findIndex((m) => m.id === messageId);
  if (index < 0 || all[index]!.role !== 'user') return;
  await messageRepo.update(messageId, { content: content.trim(), editedAt: at });
  await messageRepo.removeMany(all.slice(index + 1).map((m) => m.id));
}

export async function deleteThread(threadId: string): Promise<void> {
  const all = await messagesOf(threadId);
  await messageRepo.removeMany(all.map((m) => m.id));
  await threadRepo.remove(threadId);
}
