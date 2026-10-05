import { describe, expect, it } from 'vitest';
import { fitTurns, formatChatTurns, type Turn } from './chat';

const turns: Turn[] = [
  { role: 'user', content: 'Hallo' },
  { role: 'assistant', content: 'Guten Tag!' },
  { role: 'user', content: 'Was ist 2+2?' },
];

describe('chat prompts for the local model', () => {
  it('formats every family with all turns and ends where the answer starts', () => {
    const chatml = formatChatTurns('chatml-nothink', 'SYS', turns);
    expect(chatml).toContain('<|im_start|>assistant\nGuten Tag!<|im_end|>');
    expect(chatml.endsWith('<|im_start|>assistant\n<think>\n\n</think>\n\n')).toBe(true);
    expect(formatChatTurns('phi', 'SYS', turns).endsWith('Was ist 2+2?<|end|><|assistant|>')).toBe(
      true,
    );
    expect(formatChatTurns('mistral', 'SYS', turns)).toContain('Guten Tag!</s>[INST]Was ist');
    const gemma = formatChatTurns('gemma', 'SYS', turns);
    expect(gemma.startsWith('<start_of_turn>user\nSYS\n\nHallo')).toBe(true);
    expect(gemma.endsWith('<start_of_turn>model\n')).toBe(true);
  });

  it('drops the oldest turns first and keeps the question', () => {
    const long: Turn[] = [
      { role: 'user', content: 'a'.repeat(50) },
      { role: 'assistant', content: 'b'.repeat(50) },
      { role: 'user', content: 'c'.repeat(50) },
    ];
    const fitted = fitTurns(long, 120);
    expect(fitted.map((t) => t.content[0])).toEqual(['c']);
    expect(fitTurns([{ role: 'user', content: 'x'.repeat(500) }], 10)).toHaveLength(1);
  });
});
