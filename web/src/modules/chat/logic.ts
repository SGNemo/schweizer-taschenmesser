/** Pure helpers of the chat module: turns for the engines, titles, export, clean-up. */
import type { Stored } from '@/core/db/types';
import type { Turn } from '@/core/ai/local/prompts/chat';
import { formatDay } from '@/core/time/dates';
import type { Message, Thread } from './schema';

/** What the user's text looks like to the model: attached data first, then the question. */
export function userContent(message: Pick<Message, 'content' | 'context'>): string {
  return message.context
    ? `Daten aus der App (nur lesen, nicht erfinden):\n${message.context}\n\nFrage: ${message.content}`
    : message.content;
}

/**
 * The stored messages as strictly alternating turns that start and end with the user (providers
 * reject anything else): neighbours of the same role are joined, a leading answer is dropped.
 */
export function toTurns(messages: readonly Stored<Message>[]): Turn[] {
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
  const turns: Turn[] = [];
  for (const m of sorted) {
    const content = m.role === 'user' ? userContent(m) : m.content;
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${content}`;
    else turns.push({ role: m.role, content });
  }
  while (turns.length > 0 && turns[0]!.role !== 'user') turns.shift();
  while (turns.length > 0 && turns[turns.length - 1]!.role !== 'user') turns.pop();
  return turns;
}

/** First words of the first message, as the automatic title. */
export function autoTitle(text: string, max = 40): string {
  const line = text.trim().split('\n')[0]!.replace(/\s+/g, ' ');
  if (!line) return 'Neuer Chat';
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > 15 ? cut.slice(0, space) : cut).trimEnd()} …`;
}

export function sortThreads<T extends Pick<Thread, 'pinned'> & { updatedAt: number }>(
  threads: readonly T[],
): T[] {
  return [...threads].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
  );
}

export function searchThreads(
  threads: readonly Stored<Thread>[],
  messages: readonly Stored<Message>[],
  query: string,
): Stored<Thread>[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...threads];
  const hits = new Set(
    messages.filter((m) => m.content.toLowerCase().includes(q)).map((m) => m.threadId),
  );
  return threads.filter((t) => t.title.toLowerCase().includes(q) || hits.has(t.id));
}

/** Markdown of one chat for "Exportieren" (what the user sees, without attached data). */
export function exportMarkdown(
  thread: Pick<Thread, 'title'>,
  messages: readonly Stored<Message>[],
  names = { user: 'Du', assistant: 'Assistent' },
): string {
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
  const parts = sorted.map((m) => {
    const day = formatDay(new Date(m.createdAt).toISOString().slice(0, 10), 'dd.MM.yyyy');
    return `**${names[m.role]}** · ${day}\n\n${m.content}`;
  });
  return `# ${thread.title}\n\n${parts.join('\n\n---\n\n')}\n`;
}

/** Threads whose last activity is older than `days` (0 = keep forever); pinned ones stay. */
export function expiredThreads(
  threads: readonly Stored<Thread>[],
  days: number,
  at: number,
): Stored<Thread>[] {
  if (days <= 0) return [];
  const limit = at - days * 86_400_000;
  return threads.filter((t) => !t.pinned && t.updatedAt < limit);
}
