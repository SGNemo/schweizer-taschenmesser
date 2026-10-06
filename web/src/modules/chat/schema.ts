import { z } from 'zod';

/** Which engine answers a chat: the built-in local model or the configured providers (router). */
export const engineSchema = z.enum(['local', 'router']);
export type ChatEngine = z.output<typeof engineSchema>;

/** One conversation. Settings that belong to the chat travel with it. */
export const threadSchema = z.object({
  title: z.string().min(1),
  /** The title is still the automatic one (first words of the first message). */
  autoTitle: z.boolean().default(true),
  pinned: z.boolean().default(false),
  archived: z.boolean().default(false),
  engine: engineSchema.default('router'),
  /** Own instruction for this chat, added to the standard one. */
  systemPrompt: z.string().optional(),
  /**
   * Modules whose data the user allowed this chat to look at (`[]` = none, the default). Never
   * `accounts`; what is sent is always shown first (see `context.ts`).
   */
  contextModules: z.array(z.string()).default([]),
  tokensIn: z.number().int().nonnegative().default(0),
  tokensOut: z.number().int().nonnegative().default(0),
  /** USD, only answers of providers with a known price. */
  costUsd: z.number().nonnegative().default(0),
});
export type Thread = z.output<typeof threadSchema>;

export const messageSchema = z.object({
  threadId: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  /** Answers: which stage produced it (`local` = built-in model, `cloud` = a provider). */
  stage: z.enum(['local', 'cloud']).optional(),
  model: z.string().optional(),
  tokensIn: z.number().int().nonnegative().optional(),
  tokensOut: z.number().int().nonnegative().optional(),
  /** Questions: the text of the user's own data that was attached to this message (as sent). */
  context: z.string().optional(),
  editedAt: z.number().optional(),
});
export type Message = z.output<typeof messageSchema>;
