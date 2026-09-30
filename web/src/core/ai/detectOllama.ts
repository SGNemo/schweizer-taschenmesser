/** Best-effort check for a local Ollama server (default port). Sends nothing but a GET. */
import { getPlatform } from '@/core/platform';
import { DEFAULT_OLLAMA_URL } from './providers/ollama';

export type OllamaDetection = { found: true; models: string[] } | { found: false };

export async function detectOllama(
  fetchFn: typeof fetch = getPlatform().fetch,
  timeoutMs = 1500,
): Promise<OllamaDetection> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${DEFAULT_OLLAMA_URL}/api/tags`, { signal: controller.signal });
    if (!res.ok) return { found: false };
    const body = (await res.json()) as { models?: { name?: unknown }[] };
    const models = (body.models ?? [])
      .map((m) => m.name)
      .filter((n): n is string => typeof n === 'string');
    return { found: true, models };
  } catch {
    // Not running, blocked by CORS/mixed content, timed out: all just "not found".
    return { found: false };
  } finally {
    clearTimeout(timer);
  }
}
