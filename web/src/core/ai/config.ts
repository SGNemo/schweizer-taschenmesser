/**
 * AI provider configuration of this device: an ordered list of providers (priority = order).
 * Lives in `_secrets` – local only, never synced or exported. The list holds no secrets; API keys
 * are kept by the platform's `SecretStore` (encrypted at rest), the entry only remembers that one exists.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { getPlatform } from '@/core/platform';
import type { SecretStore } from '@/core/secrets/types';
import { createClaudeProvider } from './providers/claude';
import { createOllamaProvider } from './providers/ollama';
import { createOpenAiCompatibleProvider } from './providers/openai';
import { getPreset, PRESETS, TIER_RANK, type PresetId, type Preset } from './providers/presets';
import type { AiProvider } from './providers/types';
import { requireNotice } from '@/core/legal/notices';
import { createRouter, type RouterMember } from './router';

const CONFIG_KEY = 'aiConfig';
export const keyName = (providerId: string) => `ai-key:${providerId}`;

export const providerEntrySchema = z.object({
  id: z.string().min(1),
  preset: z.enum([
    'anthropic',
    'openai',
    'gemini',
    'groq',
    'openrouter',
    'mistral',
    'ollama',
    'custom',
  ]),
  kind: z.enum(['anthropic', 'ollama', 'openai-compatible']),
  label: z.string().default(''),
  enabled: z.boolean().default(true),
  baseUrl: z.string().default(''),
  model: z.string().default(''),
  toolMode: z.enum(['native', 'json']).default('native'),
  maxTokensParam: z.enum(['max_tokens', 'max_completion_tokens']).default('max_tokens'),
  tier: z.enum(['local', 'free', 'paid']),
  /** An API key is stored for this provider (the key itself is in the SecretStore). */
  keySet: z.boolean().default(false),
  keyRequired: z.boolean().default(true),
  mayTrainOnInputs: z.boolean().default(false),
  price: z.object({ inputPerMTok: z.number().min(0), outputPerMTok: z.number().min(0) }).optional(),
  limits: z
    .object({
      requestsPerDay: z.number().int().min(0).optional(),
      costUsdPerMonth: z.number().min(0).optional(),
    })
    .default({}),
});
export type ProviderEntry = z.output<typeof providerEntrySchema>;

export const aiConfigSchema = z.object({
  v: z.literal(2).default(2),
  providers: z.array(providerEntrySchema).default([]),
});
export type AiConfig = z.output<typeof aiConfigSchema>;

export const defaultAiConfig = (): AiConfig => aiConfigSchema.parse({});

/** A new entry from a preset, with a unique id. */
export function entryFromPreset(
  preset: Preset | PresetId,
  existing: readonly ProviderEntry[] = [],
): ProviderEntry {
  const p = typeof preset === 'string' ? getPreset(preset) : preset;
  let id: string = p.id;
  for (let n = 2; existing.some((e) => e.id === id); n++) id = `${p.id}-${n}`;
  return providerEntrySchema.parse({
    id,
    preset: p.id,
    kind: p.kind,
    label: p.label,
    enabled: true,
    baseUrl: p.baseUrl,
    model: p.model,
    toolMode: p.toolMode,
    maxTokensParam: p.maxTokensParam,
    tier: p.tier,
    keySet: false,
    keyRequired: p.keyRequired,
    mayTrainOnInputs: p.mayTrainOnInputs,
    price: p.price,
    limits: p.limits,
  });
}

/** Inserts a provider after the last one of its tier or a better tier (local → free → paid). */
export function addProvider(config: AiConfig, entry: ProviderEntry): AiConfig {
  const rank = TIER_RANK[entry.tier];
  let at = config.providers.length;
  for (let i = config.providers.length - 1; i >= 0; i--) {
    if (TIER_RANK[config.providers[i]!.tier] <= rank) break;
    at = i;
  }
  const providers = [...config.providers];
  providers.splice(at, 0, entry);
  return { ...config, providers };
}

export function moveProvider(config: AiConfig, id: string, delta: -1 | 1): AiConfig {
  const from = config.providers.findIndex((p) => p.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= config.providers.length) return config;
  const providers = [...config.providers];
  [providers[from], providers[to]] = [providers[to]!, providers[from]!];
  return { ...config, providers };
}

/** Configuration before Phase 12: one provider, key in clear text. */
const legacySchema = z.object({
  provider: z.enum(['off', 'claude', 'ollama']).default('off'),
  anthropicKey: z.string().default(''),
  claudeModel: z.string().default(''),
  ollamaUrl: z.string().default(''),
  ollamaModel: z.string().default(''),
});

const rowsOf = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_secrets');

/** Converts the old single-provider config: the key moves into the SecretStore, the row is rewritten. */
async function migrateLegacy(
  value: unknown,
  database: TaschenmesserDB,
  secrets: SecretStore,
): Promise<AiConfig> {
  const legacy = legacySchema.safeParse(value);
  if (!legacy.success) return defaultAiConfig();
  const l = legacy.data;
  let config = defaultAiConfig();
  if (l.provider === 'claude' || l.anthropicKey.trim()) {
    const entry = entryFromPreset('anthropic', config.providers);
    entry.enabled = l.provider === 'claude';
    if (l.claudeModel.trim()) entry.model = l.claudeModel.trim();
    if (l.anthropicKey.trim()) {
      await secrets.set(keyName(entry.id), l.anthropicKey.trim());
      entry.keySet = true;
    }
    config = addProvider(config, entry);
  }
  if (l.provider === 'ollama') {
    const entry = entryFromPreset('ollama', config.providers);
    if (l.ollamaUrl.trim()) entry.baseUrl = l.ollamaUrl.trim();
    if (l.ollamaModel.trim()) entry.model = l.ollamaModel.trim();
    config = addProvider(config, entry);
  }
  await rowsOf(database).put({ key: CONFIG_KEY, value: config });
  return config;
}

export async function loadAiConfig(
  database: TaschenmesserDB = defaultDb,
  secrets: SecretStore = getPlatform().secrets,
): Promise<AiConfig> {
  const row = await rowsOf(database).get(CONFIG_KEY);
  if (!row) return defaultAiConfig();
  const parsed = aiConfigSchema.safeParse(row.value);
  if (parsed.success && typeof (row.value as { v?: unknown })?.v === 'number') return parsed.data;
  return migrateLegacy(row.value, database, secrets);
}

export async function saveAiConfig(
  config: AiConfig,
  database: TaschenmesserDB = defaultDb,
): Promise<AiConfig> {
  const next = aiConfigSchema.parse(config);
  await rowsOf(database).put({ key: CONFIG_KEY, value: next });
  return next;
}

/** Stores or removes the API key of a provider and updates the entry's `keySet` flag. */
export async function setProviderKey(
  config: AiConfig,
  providerId: string,
  key: string,
  database: TaschenmesserDB = defaultDb,
  secrets: SecretStore = getPlatform().secrets,
): Promise<AiConfig> {
  const trimmed = key.trim();
  if (trimmed) await secrets.set(keyName(providerId), trimmed);
  else await secrets.delete(keyName(providerId));
  return saveAiConfig(
    {
      ...config,
      providers: config.providers.map((p) =>
        p.id === providerId ? { ...p, keySet: trimmed !== '' } : p,
      ),
    },
    database,
  );
}

export async function removeProvider(
  config: AiConfig,
  providerId: string,
  database: TaschenmesserDB = defaultDb,
  secrets: SecretStore = getPlatform().secrets,
): Promise<AiConfig> {
  await secrets.delete(keyName(providerId));
  return saveAiConfig(
    { ...config, providers: config.providers.filter((p) => p.id !== providerId) },
    database,
  );
}

/** Live config; `undefined` while loading. */
export function useAiConfig(): AiConfig | undefined {
  return useLiveQuery(() => loadAiConfig(), []);
}

/** Can this entry be used? (Enabled, model set, address/key present where the kind needs them.) */
export function isEntryUsable(e: ProviderEntry): boolean {
  if (!e.enabled || !e.model.trim()) return false;
  if (e.kind !== 'anthropic' && !e.baseUrl.trim()) return false;
  return !e.keyRequired || e.keySet;
}

export function isAiConfigured(c: AiConfig): boolean {
  return c.providers.some(isEntryUsable);
}

/** A cloud provider shows the one-time third-party notice before its first request (never for Ollama). */
function withCloudNotice(provider: AiProvider): AiProvider {
  return {
    id: provider.id,
    model: provider.model,
    complete: async (req) => {
      await requireNotice('cloud-ai');
      return provider.complete(req);
    },
  };
}

/** One adapter for one configured provider. */
export function createProviderFor(
  entry: ProviderEntry,
  apiKey: string,
  fetchFn: typeof fetch = (input, init) => getPlatform().fetch(input, init),
): AiProvider {
  const model = entry.model.trim();
  if (entry.kind === 'anthropic') {
    return withCloudNotice(
      createClaudeProvider({ id: entry.id, apiKey, model, fetch: fetchFn, maxRetries: 0 }),
    );
  }
  if (entry.kind === 'ollama') {
    return createOllamaProvider({
      id: entry.id,
      baseUrl: entry.baseUrl.trim(),
      model,
      fetch: fetchFn,
    });
  }
  return withCloudNotice(
    createOpenAiCompatibleProvider({
      id: entry.id,
      baseUrl: entry.baseUrl.trim(),
      model,
      apiKey,
      toolMode: entry.toolMode,
      maxTokensParam: entry.maxTokensParam,
      fetch: fetchFn,
    }),
  );
}

/**
 * The provider for the current settings: a router over all usable providers in priority order, or
 * undefined when none is usable (the assistant then only searches locally).
 */
export async function createRouterProvider(
  config: AiConfig,
  opts: { fetch?: typeof fetch; secrets?: SecretStore; database?: TaschenmesserDB } = {},
): Promise<AiProvider | undefined> {
  const secrets = opts.secrets ?? getPlatform().secrets;
  const members: RouterMember[] = [];
  for (const entry of config.providers.filter(isEntryUsable)) {
    const key =
      entry.keyRequired || entry.keySet ? ((await secrets.get(keyName(entry.id))) ?? '') : '';
    if (entry.keyRequired && !key) continue; // key lost (site data cleared): skip instead of failing every call
    members.push({ entry, provider: createProviderFor(entry, key, opts.fetch) });
  }
  return members.length > 0 ? createRouter({ members, database: opts.database }) : undefined;
}

export { PRESETS };
