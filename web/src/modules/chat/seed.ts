import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';
import { t } from '@/strings';

/**
 * Test data: one invented chat with a question and an answer (the widget is non-empty). Pure and
 * deterministic; no model is involved.
 */
function seed(ctx: SeedContext): SeedRows {
  const threadId = ctx.id('chat', 'thread', 0);
  return {
    thread: [
      {
        id: threadId,
        data: {
          title: t.chat.seed.title,
          autoTitle: false,
          pinned: false,
          archived: false,
          engine: 'router',
          contextModules: [],
          tokensIn: 0,
          tokensOut: 0,
          costUsd: 0,
        },
      },
    ],
    message: [
      {
        id: ctx.id('chat', 'message', 0),
        data: { threadId, role: 'user', content: t.chat.seed.question },
      },
      {
        id: ctx.id('chat', 'message', 1),
        data: {
          threadId,
          role: 'assistant',
          content: t.chat.seed.answer,
          stage: 'cloud',
          model: 'beispiel-modell',
        },
      },
    ],
  };
}

export default { seed } satisfies SeedModule;
