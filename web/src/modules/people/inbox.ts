import { z } from 'zod';
import { getSettings, setSettings } from '@/core/settings/settings';

/**
 * Gift ideas that arrived from the bookmarks ("Als Geschenkidee") and wait for a person. Kept as a small list in the
 * module settings: it is a hand-over place, not a collection, and it is emptied as ideas are assigned or dismissed.
 */
export const SCOPE = 'module.people.inbox';
export const MAX_INBOX = 30;

export const inboxSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        url: z.string().max(2000).optional(),
        priceCents: z.number().int().min(0).optional(),
      }),
    )
    .max(MAX_INBOX),
});
export type Idea = z.output<typeof inboxSchema>['ideas'][number];

export const readInbox = () => getSettings(SCOPE, inboxSchema, { ideas: [] });

/** Adds an idea unless the same title and link wait already; the oldest fall off beyond `MAX_INBOX`. */
export async function addIdea(idea: Idea): Promise<void> {
  const { ideas } = await readInbox();
  if (ideas.some((i) => i.title === idea.title && i.url === idea.url)) return;
  await setSettings(SCOPE, { ideas: [...ideas, idea].slice(-MAX_INBOX) });
}

export async function removeIdea(index: number): Promise<void> {
  const { ideas } = await readInbox();
  await setSettings(SCOPE, { ideas: ideas.filter((_, i) => i !== index) });
}
