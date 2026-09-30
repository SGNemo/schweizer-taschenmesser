/** "Verbindung testen": one tiny request that carries no user data at all. */
import { createProviderFor, type ProviderEntry } from './config';
import { AiError, type AiErrorCode } from './providers/types';
import { clearCooldown } from './router';

export type ConnectionTest =
  { ok: true; ms: number } | { ok: false; code: AiErrorCode; detail?: string };

export async function testConnection(
  entry: ProviderEntry,
  apiKey: string,
  fetchFn?: typeof fetch,
): Promise<ConnectionTest> {
  const started = performance.now();
  try {
    await createProviderFor(entry, apiKey, fetchFn).complete({
      system: 'Reply with the single word: ok',
      user: 'ping',
      tools: [],
      maxTokens: 16,
    });
    clearCooldown(entry.id); // it works – lift a pause that an earlier error caused
    return { ok: true, ms: Math.round(performance.now() - started) };
  } catch (e) {
    if (e instanceof AiError) return { ok: false, code: e.code, detail: e.message };
    return { ok: false, code: 'network', detail: e instanceof Error ? e.message : String(e) };
  }
}
