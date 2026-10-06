/**
 * Multi-turn prompts for the built-in model (chat module): the same chat families as the entry
 * prompts, with earlier turns. The model keeps no state between requests except its prompt cache,
 * so the whole (trimmed) conversation is formatted every time.
 */
import type { TemplateId } from '../catalogue';

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

/** Rough size of the prompt we allow for history + question (the context is 4096 tokens). */
export const MAX_PROMPT_CHARS = 7000;

/** Drops the oldest turns until the conversation fits; the last turn (the question) always stays. */
export function fitTurns(turns: readonly Turn[], maxChars = MAX_PROMPT_CHARS): Turn[] {
  const kept: Turn[] = [];
  let size = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i]!;
    if (kept.length > 0 && size + turn.content.length > maxChars) break;
    kept.unshift(turn);
    size += turn.content.length;
  }
  // The conversation must start with the user.
  while (kept.length > 1 && kept[0]!.role !== 'user') kept.shift();
  return kept;
}

export function formatChatTurns(
  template: TemplateId,
  system: string,
  turns: readonly Turn[],
): string {
  const fitted = fitTurns(turns);
  switch (template) {
    case 'chatml-nothink':
      return (
        `<|im_start|>system\n${system}<|im_end|>\n` +
        fitted.map((t) => `<|im_start|>${t.role}\n${t.content}<|im_end|>\n`).join('') +
        '<|im_start|>assistant\n<think>\n\n</think>\n\n'
      );
    case 'phi':
      return (
        `<|system|>${system}<|end|>` +
        fitted.map((t) => `<|${t.role}|>${t.content}<|end|>`).join('') +
        '<|assistant|>'
      );
    case 'mistral':
      return (
        `[SYSTEM_PROMPT]${system}[/SYSTEM_PROMPT]` +
        fitted
          .map((t) => (t.role === 'user' ? `[INST]${t.content}[/INST]` : `${t.content}</s>`))
          .join('')
      );
    case 'gemma':
      return (
        fitted
          .map((t, i) => {
            const role = t.role === 'user' ? 'user' : 'model';
            const text = i === 0 ? `${system}\n\n${t.content}` : t.content;
            return `<start_of_turn>${role}\n${text}<end_of_turn>\n`;
          })
          .join('') + '<start_of_turn>model\n'
      );
  }
}
