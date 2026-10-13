/**
 * Fallback router: implements `AiProvider` over an ordered list of providers.
 *
 * For every request it walks the list (priority = order) and skips providers that are cooling down
 * (after a rate limit, outage or rejected key) or have used up their local limits (requests per day,
 * cost per month). The first usable answer wins; everything else is reported as `attempts` so the
 * assistant can account for failures and fallbacks. Which provider answered does not matter for
 * caching (the cache stores validated intents, see `cache.ts`).
 *
 * Privacy is unchanged: the router forwards the request it gets – question, date, compact schemas.
 * A request that carries a conversation (`history`, the chat module) is the exception to the
 * fallback: the user was promised *one* provider for what they typed, so only the first provider
 * that is not paused or over its limit gets it. If that one fails, its error is reported instead of
 * handing the conversation to the next provider (which may be one that trains on inputs).
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { now } from '@/core/time/now';
import type { ProviderEntry } from './config';
import {
  AiError,
  type AiErrorCode,
  type AiProvider,
  type Attempt,
  type CompletionRequest,
  type CompletionResult,
} from './providers/types';
import { estimateCostUsd, usageWindow } from './usage';

export interface RouterMember {
  entry: Pick<ProviderEntry, 'id' | 'label' | 'limits' | 'price'>;
  provider: AiProvider;
}

export interface RouterOptions {
  members: readonly RouterMember[];
  database?: TaschenmesserDB;
  /** Injectable for tests. */
  now?: () => number;
}

/* ---- cooldowns (in memory: they are about the last minutes, not about history) ---- */

const cooldowns = new Map<string, { until: number; code: AiErrorCode }>();

const MINUTE = 60_000;
const MAX_COOLDOWN = 60 * MINUTE;

/** How long a provider is left alone after an error. */
export function cooldownFor(error: AiError): number {
  switch (error.code) {
    case 'rate-limit':
      return Math.min(error.retryAfterMs ?? MINUTE, MAX_COOLDOWN);
    case 'auth':
      return 30 * MINUTE; // a rejected key does not fix itself; saving the settings clears it
    case 'bad-request':
      return 5 * MINUTE; // e.g. a model without tool support
    case 'server':
    case 'network':
    case 'unavailable':
    case 'invalid-response':
      return MINUTE / 2;
    default:
      return 0;
  }
}

export function coolingDown(
  providerId: string,
  at: number,
): { until: number; code: AiErrorCode } | undefined {
  const c = cooldowns.get(providerId);
  if (!c) return undefined;
  if (c.until <= at) {
    cooldowns.delete(providerId);
    return undefined;
  }
  return c;
}

export const clearCooldown = (providerId?: string): void =>
  providerId ? void cooldowns.delete(providerId) : cooldowns.clear();

/* ---- router ---- */

function asAiError(e: unknown): AiError {
  return e instanceof AiError
    ? e
    : new AiError('invalid-response', e instanceof Error ? e.message : String(e));
}

export function createRouter(opts: RouterOptions): AiProvider {
  const clock = opts.now ?? now;
  const database = opts.database ?? defaultDb;
  const members = opts.members;
  const first = members[0]?.provider;

  return {
    id: 'router',
    model: first?.model ?? '',
    async complete(req: CompletionRequest): Promise<CompletionResult> {
      if (members.length === 0) throw new AiError('not-configured');
      const attempts: Attempt[] = [];
      let skippedForLimit = 0;
      let skippedCooling = 0;
      const singleProvider = req.history !== undefined;

      for (const { entry, provider } of members) {
        const at = clock();
        if (coolingDown(entry.id, at)) {
          skippedCooling += 1;
          continue;
        }
        const { requestsToday, costMonthUsd } = await usageWindow(entry.id, at, database);
        const { requestsPerDay, costUsdPerMonth } = entry.limits;
        if (
          (requestsPerDay !== undefined && requestsToday >= requestsPerDay) ||
          (costUsdPerMonth !== undefined && costMonthUsd >= costUsdPerMonth)
        ) {
          skippedForLimit += 1;
          continue;
        }

        try {
          const result = await provider.complete(req);
          req.check?.(result);
          return {
            ...result,
            providerId: entry.id,
            costUsd: estimateCostUsd(
              result.model,
              result.usage.inputTokens,
              result.usage.outputTokens,
              entry.price,
            ),
            attempts,
          };
        } catch (e) {
          const error = asAiError(e);
          if (error.code === 'aborted') throw error;
          attempts.push({
            providerId: entry.id,
            model: provider.model,
            error: error.code,
            detail: error.message,
          });
          const wait = cooldownFor(error);
          if (wait > 0) cooldowns.set(entry.id, { until: clock() + wait, code: error.code });
          if (singleProvider) throw new AiError(error.code, error.message, { attempts });
        }
      }

      if (attempts.length === 1 && skippedForLimit + skippedCooling === 0) {
        const only = attempts[0]!;
        throw new AiError(only.error, only.detail, { attempts });
      }
      if (attempts.length === 0 && skippedForLimit > 0 && skippedCooling === 0) {
        throw new AiError('limit-reached', undefined, { attempts });
      }
      throw new AiError(
        'exhausted',
        attempts.map((a) => `${a.providerId}: ${a.error}`).join('; ') || undefined,
        { attempts },
      );
    },
  };
}
