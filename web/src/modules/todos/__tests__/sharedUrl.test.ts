// @vitest-environment jsdom
/**
 * The ToDos source hands over a shared address (planner hub 2, package 1): only when the task's own note starts with one
 * bare http/https address of ≤ 2 048 characters and the task has no links of its own – no legacy `links[]`, no `origin`
 * link row – so the webmail address of a mail-made ToDo never becomes a chip.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { addLink } from '@/core/entitylinks';
import source from '../plannable';
import { taskRepo } from '../repo';

const URL_ = 'https://example.org/fahrradtraeger';
const make = (title: string, extra: Record<string, unknown> = {}) =>
  taskRepo.create({
    listId: 'inbox',
    title,
    done: false,
    priority: 0,
    order: 0,
    ...extra,
  } as never);
const listed = async () =>
  Object.fromEntries(
    (await source.list({ today: '2026-11-30', until: '2026-12-13' })).map((i) => [i.title, i.url]),
  );

beforeEach(async () => {
  await db.table('todos_task').clear();
  await db.table('_links').clear();
});

describe('the ToDos source and a shared address', () => {
  it('a bare first note line only, gated', async () => {
    await make('A', { note: `${URL_}\nPasst auf die Kupplung.` });
    await make('B', { note: `Schau mal ${URL_}` });
    await make('C', { note: 'www.example.org/x' });
    await make('D', { note: `https://example.org/${'a'.repeat(2100)}` });
    await make('E', { note: 'javascript:alert(1)' });
    await make('F');
    expect(await listed()).toEqual({
      A: URL_,
      B: undefined,
      C: undefined,
      D: undefined,
      E: undefined,
      F: undefined,
    });
  });

  it('never for a task with links of its own: a mail ToDo with `links[]` and no link row yet, or an `origin` row', async () => {
    const mailLink = { kind: 'mail', id: 'thread-1', label: 'Re: Termin' };
    await make('Mail', { note: 'https://mail.example/thread/1', links: [mailLink] });
    const withRow = await make('Zeile', { note: URL_ });
    await addLink({
      from: { module: 'todos', id: withRow.id },
      to: { module: 'mail', id: 'thread-2' },
      rel: 'origin',
      label: 'Aus Mail',
    } as never);
    expect(await listed()).toEqual({ Mail: undefined, Zeile: undefined });
  });
});
