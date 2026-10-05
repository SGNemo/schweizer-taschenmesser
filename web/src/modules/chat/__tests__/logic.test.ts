import { describe, expect, it } from 'vitest';
import type { Stored } from '@/core/db/types';
import { autoTitle, exportMarkdown, expiredThreads, toTurns } from '../logic';
import type { Message, Thread } from '../schema';

const msg = (id: string, role: 'user' | 'assistant', content: string, at: number, extra = {}) =>
  ({ id, threadId: 't', role, content, createdAt: at, updatedAt: at, ...extra }) as Stored<Message>;

describe('chat logic', () => {
  it('builds strictly alternating turns that start and end with the user', () => {
    const turns = toTurns([
      msg('0', 'assistant', 'orphan', 1),
      msg('1', 'user', 'a', 2),
      msg('2', 'user', 'b', 3),
      msg('3', 'assistant', 'c', 4),
      msg('4', 'user', 'd', 5),
      msg('5', 'assistant', 'unanswered tail', 6),
    ]);
    expect(turns.map((t) => t.role)).toEqual(['user', 'assistant', 'user']);
    expect(turns[0]!.content).toBe('a\n\nb');
  });

  it('puts attached data before the question', () => {
    const [turn] = toTurns([msg('1', 'user', 'Wie viel?', 1, { context: '- Miete: 900 €' })]);
    expect(turn!.content).toContain('- Miete: 900 €');
    expect(turn!.content.endsWith('Frage: Wie viel?')).toBe(true);
  });

  it('shortens the automatic title at a word', () => {
    expect(autoTitle('Kurz')).toBe('Kurz');
    const long = autoTitle(
      'Wie plane ich eine Woche mit drei Terminen und einem Einkauf im Herbst?',
    );
    expect(long.length).toBeLessThanOrEqual(45);
    expect(long.endsWith('…')).toBe(true);
  });

  it('exports Markdown without attached data', () => {
    const md = exportMarkdown(
      { title: 'Test' },
      [msg('1', 'user', 'Frage', 1, { context: 'GEHEIM' }), msg('2', 'assistant', 'Antwort', 2)],
      { user: 'Du', assistant: 'KI' },
    );
    expect(md).toContain('# Test');
    expect(md).toContain('**Du**');
    expect(md).toContain('Antwort');
    expect(md).not.toContain('GEHEIM');
  });

  it('expires only old unpinned chats', () => {
    const t = (id: string, updatedAt: number, pinned = false) =>
      ({ id, updatedAt, pinned }) as Stored<Thread>;
    const day = 86_400_000;
    const now = 100 * day;
    expect(
      expiredThreads([t('old', 0), t('pinned', 0, true), t('new', 99 * day)], 30, now).map(
        (x) => x.id,
      ),
    ).toEqual(['old']);
    expect(expiredThreads([t('old', 0)], 0, now)).toEqual([]);
  });
});
