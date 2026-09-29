/**
 * The assistant pipeline. Cheapest tier first:
 *   1. local German parser (0 tokens)      2. cached structured intent (0 tokens)
 *   3. model call (tokens are counted)     – short questions fall back to full text search.
 * Every tier ends in the same executor; results are always computed from live local data.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import type { ModuleManifest } from '@/core/modules/types';
import { executeIntent } from './query/executor';
import { AiQueryError, type AiQueryErrorCode, type AiResult } from './query/types';
import { cacheKey, getCachedIntent, putCachedIntent } from './cache';
import { contentWordCount, parseIntent } from './intent/parser';
import {
  buildSystemPrompt,
  buildTools,
  buildUserMessage,
  intentFromToolCall,
  InvalidModelAnswer,
  schemaHash,
} from './prompt';
import { AiError, type AiErrorCode, type AiProvider, type Attempt } from './providers/types';
import { searchText } from './search/fulltext';
import type { Intent } from './query/schema';
import { aiModules } from './scope';
import { recordUsage } from './usage';

export type AskErrorCode = AiErrorCode | AiQueryErrorCode | 'invalid-answer' | 'no-answer';

export interface AskDeps {
  /** Enabled modules – the only ones the assistant can see. */
  manifests: readonly ModuleManifest[];
  /** All modules that exist, to tell "disabled" from "unknown". */
  known: readonly ModuleManifest[];
  today: string;
  /** Undefined = no model configured. */
  provider?: AiProvider;
  database?: TaschenmesserDB;
  signal?: AbortSignal;
  /** Skip the "short question → full text" shortcut and ask the model. */
  forceModel?: boolean;
}

export type AskResponse =
  | {
      ok: true;
      tier: 'local' | 'cache' | 'model';
      result: AiResult;
      usage?: { inputTokens: number; outputTokens: number; model: string };
      /** The answer is a search because no model is set up for a more complex question. */
      hint?: 'no-model';
    }
  | { ok: false; error: AskErrorCode; detail?: string };

const fail = (e: unknown): AskResponse => {
  if (e instanceof AiQueryError) return { ok: false, error: e.code, detail: e.detail };
  if (e instanceof AiError) return { ok: false, error: e.code, detail: e.message };
  if (e instanceof InvalidModelAnswer)
    return { ok: false, error: 'invalid-answer', detail: e.message };
  throw e;
};

export async function ask(question: string, deps: AskDeps): Promise<AskResponse> {
  const database = deps.database ?? defaultDb;
  // Modules without an aiSchema (the password vault) do not exist for the assistant.
  const manifests = aiModules(deps.manifests);
  const known = aiModules(deps.known);
  const ctx = { manifests, known, database, today: deps.today };
  const q = question.trim();
  if (!q) return { ok: false, error: 'no-answer' };

  try {
    // Tier 1: local parser.
    if (!deps.forceModel) {
      const parsed = parseIntent(q, { today: deps.today });
      if (parsed.kind === 'intent') {
        return { ok: true, tier: 'local', result: await executeIntent(parsed.intent, ctx) };
      }
      // Short free text: a plain search is what people mean ("miete", "netflix").
      if (contentWordCount(q) <= 2) {
        return { ok: true, tier: 'local', result: await searchText(q, ctx) };
      }
    }

    if (!deps.provider) {
      return { ok: true, tier: 'local', result: await searchText(q, ctx), hint: 'no-model' };
    }

    // Tier 2: cache.
    const key = await cacheKey({
      question: q,
      today: deps.today,
      schemaHash: schemaHash(manifests),
    });
    const cached = await getCachedIntent(key, database);
    if (cached) {
      const result = await executeIntent(cached, ctx);
      await recordUsage(
        {
          provider: deps.provider.id,
          model: deps.provider.model,
          inputTokens: 0,
          outputTokens: 0,
          cacheHit: true,
        },
        database,
      );
      return { ok: true, tier: 'cache', result };
    }

    // Tier 3: model. Only the question, today's date and the compact schemas leave the device.
    const response = await deps.provider.complete({
      system: buildSystemPrompt(manifests),
      user: buildUserMessage(q, deps.today),
      tools: buildTools(manifests),
      signal: deps.signal,
      // An answer that is not even a well-formed intent is a reason to try the next provider.
      check: (r) => {
        if (r.toolCalls[0]) intentFromToolCall(r.toolCalls[0]);
      },
    });
    await recordAttempts(response.attempts, database);
    await recordUsage(
      {
        provider: response.providerId ?? deps.provider.id,
        model: response.model,
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        cacheHit: false,
        outcome: 'ok',
        viaFallback: (response.attempts?.length ?? 0) > 0,
        costUsd: response.costUsd,
      },
      database,
    );
    const call = response.toolCalls[0];
    let intent: Intent;
    if (call) intent = intentFromToolCall(call);
    else if (response.text) intent = { type: 'message', text: response.text.slice(0, 600) };
    else return { ok: false, error: 'no-answer' };

    const result = await executeIntent(intent, ctx); // validates against the aiSchemas
    await putCachedIntent(key, intent, database);
    return {
      ok: true,
      tier: 'model',
      result,
      usage: { ...response.usage, model: response.model },
    };
  } catch (e) {
    if (e instanceof AiError) await recordAttempts(e.attempts, database);
    return fail(e);
  }
}

/** Failed provider calls (from the router) go into the statistics. */
async function recordAttempts(
  attempts: readonly Attempt[] | undefined,
  database: TaschenmesserDB,
): Promise<void> {
  for (const a of attempts ?? []) {
    await recordUsage(
      {
        provider: a.providerId,
        model: a.model,
        inputTokens: 0,
        outputTokens: 0,
        cacheHit: false,
        outcome: 'error',
        errorCode: a.error,
      },
      database,
    );
  }
}
