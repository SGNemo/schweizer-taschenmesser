/**
 * "Tagesüberblick": a short German summary of today's headlines, only on an explicit button press.
 *
 * What leaves the device: a fixed instruction and up to 30 lines "[source] title" – public headlines,
 * nothing else (no article text, no user data, no schema). No tools, no second call, the result is
 * not stored. Uses the same router (and accounting) as the assistant.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { recordUsage } from './usage';
import { AiError, type AiErrorCode, type AiProvider } from './providers/types';

export interface Headline {
  source: string;
  title: string;
}

export const MAX_HEADLINES = 30;
const MAX_TITLE = 160;

export const BRIEF_SYSTEM =
  'You write a short daily news overview for a private reader, in German. Use ONLY the headlines ' +
  'given below; do not add facts, numbers or details that are not in them. Group related headlines ' +
  'by topic, use 4 to 8 short bullet points (start each line with "• "), plain text without markdown ' +
  'headings, no introduction and no closing remarks.';

export function buildBriefMessage(headlines: readonly Headline[]): string {
  const lines = headlines
    .slice(0, MAX_HEADLINES)
    .map((h) => `[${h.source.slice(0, 40)}] ${h.title.slice(0, MAX_TITLE)}`);
  return `Schlagzeilen:\n${lines.join('\n')}`;
}

export type BriefResult =
  | { ok: true; text: string; usage: { inputTokens: number; outputTokens: number; model: string } }
  | { ok: false; error: AiErrorCode | 'no-headlines' | 'no-answer' };

export async function newsBrief(
  headlines: readonly Headline[],
  deps: { provider: AiProvider | undefined; signal?: AbortSignal; database?: TaschenmesserDB },
): Promise<BriefResult> {
  const database = deps.database ?? defaultDb;
  if (headlines.length === 0) return { ok: false, error: 'no-headlines' };
  if (!deps.provider) return { ok: false, error: 'not-configured' };
  try {
    const response = await deps.provider.complete({
      system: BRIEF_SYSTEM,
      user: buildBriefMessage(headlines),
      tools: [],
      maxTokens: 700,
      signal: deps.signal,
    });
    for (const a of response.attempts ?? [])
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
    const text = response.text.trim();
    if (!text) return { ok: false, error: 'no-answer' };
    return {
      ok: true,
      text: text.slice(0, 2000),
      usage: {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        model: response.model,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof AiError ? e.code : 'network' };
  }
}
