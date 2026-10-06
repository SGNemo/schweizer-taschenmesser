/** Everything a provider needs: only text and tool definitions – never user data. */
export interface ToolDef {
  name: string;
  description: string;
  /** JSON schema of the tool input. */
  input_schema: Record<string, unknown>;
}

/** An earlier turn of a conversation (chat module); the assistant pipeline does not use it. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  system: string;
  /** Earlier turns, oldest first, strictly alternating and starting with `user`. */
  history?: readonly ChatTurn[];
  user: string;
  tools: ToolDef[];
  signal?: AbortSignal;
  /** Output limit (default 1024); the connection test uses a tiny one. */
  maxTokens?: number;
  /**
   * Cheap plausibility check of an answer (e.g. "is this tool call a valid intent?"). Throwing marks
   * the answer as unusable, so the router tries the next provider instead of surfacing it.
   */
  check?: (result: CompletionResult) => void;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompletionResult {
  toolCalls: { name: string; input: unknown }[];
  /** Plain text answer, if the model wrote one. */
  text: string;
  usage: TokenUsage;
  model: string;
  /** Set by the router: which configured provider answered … */
  providerId?: string;
  /** … what that call cost (USD, from the editable price of the provider) … */
  costUsd?: number;
  /** … and which providers failed before it (fallbacks). */
  attempts?: Attempt[];
}

/** A provider call that did not lead to an answer. */
export interface Attempt {
  providerId: string;
  model: string;
  error: AiErrorCode;
  detail?: string;
}

export interface AiProvider {
  /** Id of the configured provider entry (`router` for the fallback router). */
  readonly id: string;
  readonly model: string;
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

export type AiErrorCode =
  | 'auth'
  | 'rate-limit'
  | 'network'
  | 'bad-request'
  | 'server'
  | 'refusal'
  | 'aborted'
  | 'unavailable'
  | 'not-configured'
  /** The provider answered, but not in a usable format (bad JSON, unknown structure, invalid intent). */
  | 'invalid-response'
  /** Every provider is used up (local limits) – nothing was sent. */
  | 'limit-reached'
  /** Several providers were tried; none produced an answer. */
  | 'exhausted';

export class AiError extends Error {
  /** `Retry-After` of a rate limit, in ms. */
  readonly retryAfterMs?: number;
  /** Failed provider calls that led to this error (router). */
  readonly attempts?: Attempt[];

  constructor(
    readonly code: AiErrorCode,
    message: string = code,
    extra: { retryAfterMs?: number; attempts?: Attempt[] } = {},
  ) {
    super(message);
    this.name = 'AiError';
    this.retryAfterMs = extra.retryAfterMs;
    this.attempts = extra.attempts;
  }
}
