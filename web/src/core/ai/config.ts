/** Assistant settings of this device. Lives in `_secrets` (holds the API key): never synced or exported. */
import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { createClaudeProvider, DEFAULT_CLAUDE_MODEL } from './providers/claude';
import { createOllamaProvider, DEFAULT_OLLAMA_MODEL, DEFAULT_OLLAMA_URL } from './providers/ollama';
import type { AiProvider } from './providers/types';

const CONFIG_KEY = 'aiConfig';

export const aiConfigSchema = z.object({
  provider: z.enum(['off', 'claude', 'ollama']).default('off'),
  anthropicKey: z.string().default(''),
  claudeModel: z.string().default(DEFAULT_CLAUDE_MODEL),
  ollamaUrl: z.string().default(DEFAULT_OLLAMA_URL),
  ollamaModel: z.string().default(DEFAULT_OLLAMA_MODEL),
});
export type AiConfig = z.output<typeof aiConfigSchema>;

export const defaultAiConfig = (): AiConfig => aiConfigSchema.parse({});

export async function loadAiConfig(database: TaschenmesserDB = defaultDb): Promise<AiConfig> {
  const row = await database
    .table<{ key: string; value: unknown }, string>('_secrets')
    .get(CONFIG_KEY);
  const parsed = aiConfigSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : defaultAiConfig();
}

export async function saveAiConfig(
  patch: Partial<AiConfig>,
  database: TaschenmesserDB = defaultDb,
): Promise<AiConfig> {
  const next = aiConfigSchema.parse({ ...(await loadAiConfig(database)), ...patch });
  await database.table('_secrets').put({ key: CONFIG_KEY, value: next });
  return next;
}

/** Live config; `undefined` while loading. */
export function useAiConfig(): AiConfig | undefined {
  return useLiveQuery(() => loadAiConfig(), []);
}

export function isAiConfigured(c: AiConfig): boolean {
  if (c.provider === 'claude') return c.anthropicKey.trim().length > 0;
  if (c.provider === 'ollama')
    return c.ollamaUrl.trim().length > 0 && c.ollamaModel.trim().length > 0;
  return false;
}

/** The provider for the current settings, or undefined when the model is switched off / incomplete. */
export function createProvider(
  c: AiConfig,
  opts: { fetch?: typeof fetch } = {},
): AiProvider | undefined {
  if (!isAiConfigured(c)) return undefined;
  return c.provider === 'claude'
    ? createClaudeProvider({
        apiKey: c.anthropicKey.trim(),
        model: c.claudeModel.trim(),
        fetch: opts.fetch,
      })
    : createOllamaProvider({
        baseUrl: c.ollamaUrl.trim(),
        model: c.ollamaModel.trim(),
        fetch: opts.fetch,
      });
}
