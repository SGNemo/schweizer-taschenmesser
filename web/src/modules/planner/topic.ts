/**
 * Topics (planner hub 2, package 11; CONCEPT-INTAKE idea 11, hand-off 11): a bracket around things of several modules.
 * A topic is one planner row (`planner_topic`, a title) and one `topic` link per member (`planner:t_<id>` → the thing,
 * which stores the thing itself – `entityId` for an occurrence row). No module gets a field; the planner never reads
 * ToDo tags.
 *
 * Only the planner's own actions write `topic` links, each inside one undoable action: „Thema …“ gives one topic per
 * thing (a second replaces the first in the same action – the only place a stale topic link is ever removed), deleting
 * a topic removes its links (no thing is touched). Two devices that gave the same thing two topics offline keep both
 * rows; the reader takes the later one, and the next „Thema …“ on that thing tidies up.
 *
 * Device state in `_meta` (never synced): the filter (`TOPIC_FILTER_KEY`) and the last used topic (`TOPIC_LAST_KEY`).
 */
import { setMeta } from '@/core/db/metaKv';
import { randomId } from '@/core/db/util';
import { addLink, isLinkable, linksFrom, linksTo, removeLink } from '@/core/entitylinks';
import { entityRefOf, refKey, type EntityRef } from '@/core/entitylinks/types';
import type { PlannableEntry } from '@/core/modules/contributions';
import { undoableWithToast } from '@/core/undo/withToast';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { MODULE_ID, topicRepo } from './repo';
import { TOPIC_TITLE_MAX } from './schema';

export const TOPIC_FILTER_KEY = 'planner.topic.filter';
export const TOPIC_LAST_KEY = 'planner.topic.last';

/** A new topic's record id: `t_<uuid>` (its link ref is `planner:t_<uuid>`, the purge sweep finds it). */
export const newTopicId = (): string => `t_${randomId()}`;

/** The ref a topic's links start at. */
export const topicRef = (id: string): EntityRef => ({ module: MODULE_ID, id });

/**
 * The thing a row gives a topic to, or none: only a thing whose module is a link target, never a pile row (its members
 * take a topic, package 2). The link stores the thing itself (`entityId` for an occurrence row).
 */
export function topicThing(
  e: Pick<PlannableEntry, 'moduleId' | 'id' | 'entityId' | 'kind'>,
): EntityRef | undefined {
  if (e.kind === 'pile' || !isLinkable(e.moduleId)) return undefined;
  return entityRefOf(e.moduleId, e);
}

/** A typed name as a topic title: one line, trimmed, at most 60 characters; empty → undefined. */
export function topicTitle(raw: string): string | undefined {
  const one = raw.replace(/\s+/gu, ' ').trim();
  if (!one) return undefined;
  // Counted as the schema counts (`.length`), never cutting a character in two.
  let out = '';
  for (const ch of one) {
    if (out.length + ch.length > TOPIC_TITLE_MAX) break;
    out += ch;
  }
  return out;
}

/** The topic a thing has: of several `topic` links to it (two devices, offline), the later one. */
export function topicOfLinks(
  links: readonly { link: { from: EntityRef }; updatedAt: number; id: string }[],
): string | undefined {
  const own = links.filter((l) => l.link.from.module === MODULE_ID);
  if (own.length === 0) return undefined;
  const latest = own.reduce((a, b) =>
    b.updatedAt > a.updatedAt || (b.updatedAt === a.updatedAt && b.id > a.id) ? b : a,
  );
  return latest.link.from.id;
}

/**
 * The topic of each thing (by `refKey`), read at once. A link from a topic deleted elsewhere is not counted (device B
 * gave it while A deleted the topic), so it never shadows the thing's live topic.
 */
export async function topicsOf(things: readonly EntityRef[]): Promise<Map<string, string>> {
  const all = (await linksTo(things, ['topic'])).filter((l) => l.link.from.module === MODULE_ID);
  const ids = [...new Set(all.map((l) => l.link.from.id))];
  const alive = new Set(
    (await Promise.all(ids.map((id) => topicRepo.get(id)))).flatMap((x) => (x ? [x.id] : [])),
  );
  const links = all.filter((l) => alive.has(l.link.from.id));
  const by = new Map<string, typeof links>();
  for (const l of links) {
    const key = refKey(l.link.to);
    by.set(key, [...(by.get(key) ?? []), l]);
  }
  const out = new Map<string, string>();
  for (const [key, list] of by) {
    const id = topicOfLinks(list);
    if (id) out.set(key, id);
  }
  return out;
}

/** The members of a topic: the things its `topic` links lead to. */
export async function membersOf(topicId: string): Promise<EntityRef[]> {
  return (await linksFrom([topicRef(topicId)], ['topic'])).map((l) => l.to);
}

/**
 * The things the filter shows for a topic: its members, less those two devices gave another topic offline that the
 * reader takes (the later one) – the same answer the chooser gives (`refKey`s).
 */
export async function shownMembers(topicId: string): Promise<Set<string>> {
  const of = await topicsOf(await membersOf(topicId));
  return new Set([...of].filter(([, id]) => id === topicId).map(([key]) => key));
}

/** What „Thema …“ chose: an existing topic, a new name, or none. */
export type TopicChoice = { id: string } | { title: string } | null;

/**
 * „Thema …“ / T12 for one or more things, as one undoable action with toast T8: the chosen topic (a new name creates it
 * in the same action), every other topic link to these things removed. `null` takes the things out of every topic.
 * Returns the topic id (none for `null`). The last used topic is remembered on this device.
 */
export async function setTopic(
  things: readonly EntityRef[],
  choice: TopicChoice,
): Promise<string | undefined> {
  if (things.length === 0) return undefined;
  let topicId: string | undefined;
  let title = '';
  if (choice && 'id' in choice) {
    const topic = await topicRepo.get(choice.id);
    // Deleted meanwhile (another device, or a stale T12): say so instead of doing nothing.
    if (!topic) {
      useUiStore.getState().toast(t.planner.topic.gone);
      return undefined;
    }
    topicId = choice.id;
    title = topic.title;
  } else if (choice) {
    const named = topicTitle(choice.title);
    if (!named) return undefined;
    title = named;
  }
  const message = choice ? t.planner.topic.given(things.length, title) : t.planner.topic.removed;
  await undoableWithToast(t.planner.topic.give, message, async () => {
    if (choice && !('id' in choice)) {
      topicId = newTopicId();
      await topicRepo.create({ title }, { id: topicId });
    }
    // One topic per thing: every other topic link to it goes, in this same action.
    for (const old of await linksTo(things, ['topic']))
      if (old.link.from.module === MODULE_ID && old.link.from.id !== topicId)
        await removeLink(old.id);
    if (topicId)
      for (const thing of things)
        await addLink({ from: topicRef(topicId), to: thing, rel: 'topic', label: title });
  });
  if (topicId) await setMeta(TOPIC_LAST_KEY, topicId);
  return topicId;
}

/** T9: deletes a topic and its links as one undoable action; no thing is touched. A filter on it ends with it. */
export async function deleteTopic(id: string): Promise<void> {
  const topic = await topicRepo.get(id);
  if (!topic) return;
  await undoableWithToast(
    t.planner.topic.delete,
    t.planner.topic.deleted(topic.title),
    async () => {
      for (const l of await linksTo(await membersOf(id), ['topic']))
        if (l.link.from.module === MODULE_ID && l.link.from.id === id) await removeLink(l.id);
      await topicRepo.remove(id);
    },
  );
  // The filter and the last used topic stay as they are: the view reads a gone topic as none (no filter, no T12),
  // and „Rückgängig“ brings the topic back with the page as it was.
}

/** Renames a topic (one undo). Stored link labels are a snapshot and stay. */
export async function renameTopic(id: string, raw: string): Promise<boolean> {
  const title = topicTitle(raw);
  if (!title || !(await topicRepo.get(id))) return false;
  await undoableWithToast(t.planner.topic.rename, t.planner.topic.renamed(title), () =>
    topicRepo.update(id, { title }),
  );
  return true;
}

/** The filter (device state): the topic shown, or none. */
export const setTopicFilter = (id: string | null): Promise<void> => setMeta(TOPIC_FILTER_KEY, id);
