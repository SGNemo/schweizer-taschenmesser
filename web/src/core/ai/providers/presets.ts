/**
 * Known providers with sensible defaults. Everything here is only a starting point that the user can
 * change in the settings (base URL, model, prices, limits): model names and prices change often, so
 * none of these values is authoritative.
 */

export type ProviderKind = 'anthropic' | 'ollama' | 'openai-compatible';
export type Tier = 'local' | 'free' | 'paid';
export type PresetId =
  'anthropic' | 'openai' | 'gemini' | 'groq' | 'openrouter' | 'mistral' | 'ollama' | 'custom';

export interface Price {
  /** USD per million tokens. */
  inputPerMTok: number;
  outputPerMTok: number;
}

export interface Preset {
  id: PresetId;
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  tier: Tier;
  toolMode: 'native' | 'json';
  /** Which output-limit parameter the API expects (newer OpenAI models reject `max_tokens`). */
  maxTokensParam: 'max_tokens' | 'max_completion_tokens';
  keyRequired: boolean;
  /** Free tiers commonly use inputs to improve their models. */
  mayTrainOnInputs: boolean;
  price?: Price;
  limits: { requestsPerDay?: number; costUsdPerMonth?: number };
  /** Where to create an API key (shown as a link in the settings). */
  keyUrl?: string;
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'ollama',
    label: 'Ollama (lokal)',
    kind: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'qwen2.5:7b',
    tier: 'local',
    toolMode: 'native',
    maxTokensParam: 'max_tokens',
    keyRequired: false,
    mayTrainOnInputs: false,
    price: { inputPerMTok: 0, outputPerMTok: 0 },
    limits: {},
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (kostenlose Modelle)',
    kind: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    tier: 'free',
    toolMode: 'native',
    maxTokensParam: 'max_tokens',
    keyRequired: true,
    mayTrainOnInputs: true,
    price: { inputPerMTok: 0, outputPerMTok: 0 },
    limits: { requestsPerDay: 50 },
    keyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    tier: 'free',
    toolMode: 'native',
    maxTokensParam: 'max_tokens',
    keyRequired: true,
    mayTrainOnInputs: true,
    price: { inputPerMTok: 0, outputPerMTok: 0 },
    limits: { requestsPerDay: 1000 },
    keyUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    kind: 'openai-compatible',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
    tier: 'free',
    toolMode: 'native',
    maxTokensParam: 'max_tokens',
    keyRequired: true,
    mayTrainOnInputs: true,
    price: { inputPerMTok: 0, outputPerMTok: 0 },
    limits: { requestsPerDay: 200 },
    keyUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    kind: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
    tier: 'paid',
    toolMode: 'native',
    maxTokensParam: 'max_tokens',
    keyRequired: true,
    mayTrainOnInputs: false,
    price: { inputPerMTok: 0.2, outputPerMTok: 0.6 },
    limits: { costUsdPerMonth: 2 },
    keyUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    tier: 'paid',
    toolMode: 'native',
    maxTokensParam: 'max_completion_tokens',
    keyRequired: true,
    mayTrainOnInputs: false,
    price: { inputPerMTok: 0.15, outputPerMTok: 0.6 },
    limits: { costUsdPerMonth: 2 },
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Claude (Anthropic)',
    kind: 'anthropic',
    baseUrl: '',
    model: 'claude-haiku-4-5',
    tier: 'paid',
    toolMode: 'native',
    maxTokensParam: 'max_tokens',
    keyRequired: true,
    mayTrainOnInputs: false,
    price: { inputPerMTok: 1, outputPerMTok: 5 },
    limits: { costUsdPerMonth: 2 },
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'custom',
    label: 'Eigener Anbieter (OpenAI-kompatibel)',
    kind: 'openai-compatible',
    baseUrl: '',
    model: '',
    tier: 'paid',
    toolMode: 'native',
    maxTokensParam: 'max_tokens',
    keyRequired: false,
    mayTrainOnInputs: false,
    limits: {},
  },
];

export const getPreset = (id: PresetId): Preset => PRESETS.find((p) => p.id === id)!;

/** Default priority: local first, then free tiers, then paid providers. */
export const TIER_RANK: Record<Tier, number> = { local: 0, free: 1, paid: 2 };
