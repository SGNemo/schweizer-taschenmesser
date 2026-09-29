/** Everything a provider needs: only text and tool definitions – never user data. */
export interface ToolDef {
  name: string;
  description: string;
  /** JSON schema of the tool input. */
  input_schema: Record<string, unknown>;
}

export interface CompletionRequest {
  system: string;
  user: string;
  tools: ToolDef[];
  signal?: AbortSignal;
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
}

export interface AiProvider {
  readonly id: 'claude' | 'ollama';
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
  | 'not-configured';

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'AiError';
  }
}
