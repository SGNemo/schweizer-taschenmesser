import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { addIdea, MAX_INBOX, readInbox, removeIdea } from '../inbox';

beforeEach(async () => {
  await db.table('_settings').clear();
});

describe('gift ideas waiting for a person', () => {
  it('keeps an idea once, removes by index and caps the list', async () => {
    await addIdea({ title: 'Buch', url: 'https://example.org/a' });
    await addIdea({ title: 'Buch', url: 'https://example.org/a' });
    await addIdea({ title: 'Tasse' });
    expect((await readInbox()).ideas.map((i) => i.title)).toEqual(['Buch', 'Tasse']);
    await removeIdea(0);
    expect((await readInbox()).ideas.map((i) => i.title)).toEqual(['Tasse']);
    for (let i = 0; i < MAX_INBOX + 5; i++) await addIdea({ title: `Idee ${i}` });
    expect((await readInbox()).ideas).toHaveLength(MAX_INBOX);
  });
});
