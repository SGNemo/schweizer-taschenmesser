// @vitest-environment jsdom
/**
 * The link table is nobody's module data: a row of `_links` reaches no data API or OpenAPI output, no local API
 * answer, no assistant request, no search index, no share file, no automation event and no diagnostics text
 * (docs/design/planner-hub/CONCEPT-LINKS.md §1.2). And the vault is never an end of a link – on write, on read
 * and in the copy of the ToDo links (§1.4).
 *
 * The canaries live in `_links` only: a ToDo's own frozen `links[]` field is module data and stays where it is.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ask } from '@/core/ai/assistant';
import { createProviderFor, entryFromPreset } from '@/core/ai/config';
import { buildSchemaText, buildSystemPrompt, buildTools, buildUserMessage } from '@/core/ai/prompt';
import { clearCooldown, createRouter } from '@/core/ai/router';
import { aiModules } from '@/core/ai/scope';
import { resetSearchIndexes, searchIndexFor } from '@/core/ai/search';
import { clearAll, ctxFor, seed, TODAY, useFixedClock } from '@/core/ai/testing';
import { eventsOf, splitTable } from '@/core/automation/ingest';
import { buildExample } from '@/core/dataapi/example';
import { buildOpenApi } from '@/core/dataapi/openapi';
import { apiCollections, apiModules } from '@/core/dataapi/scope';
import { buildAiSchemaText } from '@/core/dataapi/text';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { setWriteListener, type WriteSignal } from '@/core/db/writeHook';
import { buildDiagnostics, renderDiagnostics } from '@/core/diagnostics/export';
import { issueUrl, mailtoUrl, reportFacts } from '@/core/diagnostics/report';
import { createToken, updateConfig } from '@/core/localapi/config';
import { handleRequest } from '@/core/localapi/handler';
import { allManifests, getManifest, visibleManifests } from '@/core/modules/registry';
import {
  createShareFile,
  readShareFile,
  shareableModules,
  shareableTables,
} from '@/core/share/share';
import { setNow } from '@/core/time/now';
import {
  addLink,
  addLinkIfAbsent,
  addLinksIfAbsent,
  linkEntries,
  linksOf,
  removeLink,
  linkId,
} from './index';
import { copyTodoLinks } from './migrate';
import { isLinkable, LINKS_TABLE, readLink } from './store';
import type { EntityLink } from './types';

// One word each, so a tokenising index would hold them as they are (lower case).
const LABEL = 'Quittenkompottrechnung7391';
const THREAD = 'thrquittenfaden0042';
const TASK = 'aufgabequittenstrauch55';
const DAY = '2031-03-04';
const CANARIES = [LABEL, THREAD, TASK, DAY];

const link: EntityLink = {
  from: { module: 'todos', id: TASK },
  to: { module: 'mail', id: THREAD },
  rel: 'dunning',
  label: LABEL,
  on: DAY,
};

const clean = (text: string, where: string) => {
  const lower = text.toLowerCase();
  for (const c of CANARIES) expect(lower, `${where} leaked ${c}`).not.toContain(c.toLowerCase());
};

async function enableEverything(): Promise<void> {
  for (const m of visibleManifests)
    await db.table('_modules').put({
      id: m.id,
      enabled: true,
      dataPolicy: null,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 't',
      deletedAt: null,
      _f: {},
    });
}

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  for (const t of [LINKS_TABLE, '_modules', '_meta', '_imports']) await db.table(t).clear();
  await seed();
  await addLink(link);
  // A second, removed one: a tombstone must not leak either.
  await addLink({ ...link, to: { module: 'notes', id: `${THREAD}n` } });
  await removeLink(await linkId({ ...link, to: { module: 'notes', id: `${THREAD}n` } }));
  clearCooldown();
});
afterEach(() => {
  setWriteListener(undefined);
  resetSearchIndexes();
});
afterAll(() => setNow());

describe('a `_links` row reaches no surface', () => {
  it('the table belongs to no manifest, so no surface that enumerates manifests can name it', () => {
    for (const m of allManifests) {
      expect(m.id).not.toBe('links');
      for (const c of Object.keys(m.dataSchema.collections))
        expect(`${m.id}_${c}`).not.toBe(LINKS_TABLE);
    }
    expect(splitTable(LINKS_TABLE)).toBeUndefined();
  });

  it('data API and OpenAPI: no schema, example or collection of it – and no content', async () => {
    await enableEverything();
    const states = Object.fromEntries(visibleManifests.map((m) => [m.id, true]));
    const modules = apiModules(allManifests, states);
    expect(modules.length).toBeGreaterThan(3);
    const out = JSON.stringify([
      buildOpenApi(modules),
      modules.map((m) => [m.id, apiCollections(m), buildAiSchemaText(m), buildExample(m)]),
    ]);
    clean(out, 'data API');
    for (const word of ['_links', 'entitylinks', 'fromKey', 'toKey'])
      expect(out).not.toContain(word);
  });

  it('local API: every readable route of every module with a full-read token', async () => {
    await enableEverything();
    await updateConfig({ enabled: true });
    const grants = Object.fromEntries(allManifests.map((m) => [m.id, { read: true, write: true }]));
    const { entry } = await createToken({
      name: 'Alles',
      grants,
      expiresInDays: 30,
      autoCommit: false,
    });
    let id = 1;
    const get = (path: string, query = 'limit=200') =>
      handleRequest(
        { id: id++, tokenId: entry.id, method: 'GET', path, query },
        { manifests: allManifests },
      );
    const listed = await get('/v1/modules');
    expect(listed.status).toBe(200);
    const bodies: unknown[] = [listed.body, (await get('/v1/openapi.json')).body];
    let read = 0;
    for (const m of allManifests) {
      for (const collection of [...apiCollections(m), 'links', '_links']) {
        const res = await get(`/v1/${m.id}/items`, `limit=200&collection=${collection}`);
        bodies.push(res.body, res.log);
        if (res.status === 200) read++;
      }
      // Also by the canary itself: the search of the route finds nothing to return.
      for (const collection of apiCollections(m)) {
        const res = await get(`/v1/${m.id}/items`, `collection=${collection}&q=${LABEL}`);
        if (res.status === 200) expect((res.body as { items: unknown[] }).items).toEqual([]);
      }
    }
    expect(read).toBeGreaterThan(10);
    clean(JSON.stringify(bodies), 'local API');
    // Nothing answers under a name one might guess for the table – exactly like any unknown module.
    const unknown = await get('/v1/doesnotexist/items');
    for (const name of ['links', 'entitylinks', 'core', 'link']) {
      const res = await get(`/v1/${name}/items`);
      expect([res.status, res.body]).toEqual([unknown.status, unknown.body]);
    }
    expect((await get('/v1/_links/items')).status).toBe(404);
  });

  it('assistant: prompt, schemas, tools and the request body of a real round', async () => {
    const { manifests, known } = ctxFor();
    const all = aiModules(visibleManifests);
    clean(
      JSON.stringify([
        buildSchemaText(all),
        buildSystemPrompt(all),
        buildUserMessage('Was ist verknüpft?', TODAY),
        buildTools(all),
      ]),
      'assistant prompt',
    );
    const sent: string[] = [];
    const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push(
        String(input) + JSON.stringify([...new Headers(init?.headers)]) + String(init?.body),
      );
      return new Response(
        JSON.stringify({
          model: 'm',
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      name: 'run_query',
                      arguments: JSON.stringify({
                        module: 'todos',
                        collection: 'task',
                        filters: [],
                        aggregate: 'count',
                      }),
                    },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;
    const e = { ...entryFromPreset('openai'), keySet: true };
    const provider = createRouter({
      members: [{ entry: e, provider: createProviderFor(e, 'sk-test', fetchFn) }],
    });
    const res = await ask('Welche Verknüpfungen hat meine Aufgabe zur Rechnung?', {
      manifests,
      known,
      today: TODAY,
      provider,
      database: db,
    });
    expect(sent.length).toBeGreaterThan(0);
    clean(sent.join('\n') + JSON.stringify(res), 'assistant request');
    expect(sent.join('\n')).not.toContain('_links');
  });

  it('search index: no document, no term', async () => {
    const index = searchIndexFor(db, aiModules(visibleManifests));
    await index.ready();
    expect(index.mini.documentCount).toBeGreaterThan(0);
    for (const c of CANARIES) expect(index.mini.search(c, { fuzzy: false })).toEqual([]);
    clean(JSON.stringify(index.mini), 'search index');
    index.stop();
  });

  it('share file: no module to pick it with, no table in the file', async () => {
    expect(shareableTables()).not.toContain(LINKS_TABLE);
    const modules = shareableModules().map((m) => m.id);
    const code = 'apfel birne kirsche dattel feige gurke';
    const text = await createShareFile({ modules, code, kdf: { m: 8, t: 1, p: 1 } });
    const read = await readShareFile(text, code);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(Object.keys(read.backup.tables)).not.toContain(LINKS_TABLE);
    expect(Object.keys(read.backup.tables).length).toBeGreaterThan(3);
    clean(JSON.stringify(read.backup), 'share file');
    // Asking for it by a guessed name shares nothing of it either.
    for (const name of ['core', '_links', 'links']) {
      const forced = await readShareFile(
        await createShareFile({ modules: [name, 'todos'], code, kdf: { m: 8, t: 1, p: 1 } }),
        code,
      );
      if (forced.ok) clean(JSON.stringify(forced.backup), `share file (${name})`);
    }
  });

  it('automation: a write to the table is no event', async () => {
    const seen: WriteSignal[] = [];
    setWriteListener((s) => seen.push(s));
    const other = { ...link, to: { module: 'calendar', id: `${THREAD}e` } };
    const undo = await addLink(other);
    await undo();
    await addLink(other);
    setWriteListener(undefined);
    expect(seen.map((s) => [s.table, s.kind])).toEqual([
      [LINKS_TABLE, 'created'],
      [LINKS_TABLE, 'deleted'],
      [LINKS_TABLE, 'restored'],
    ]);
    for (const signal of seen) {
      expect(eventsOf(signal, 1)).toEqual([]);
      expect(
        eventsOf(
          signal,
          1,
          (_s, base) => [base],
          () => true,
        ),
        'not even for a rule that watches everything',
      ).toEqual([]);
    }
  });

  it('diagnostics and bug report: no label, id or day', async () => {
    const d = await buildDiagnostics();
    clean(JSON.stringify(d) + renderDiagnostics(d), 'diagnostics');
    expect(Object.keys(d.counts)).not.toContain(LINKS_TABLE);
    const facts = await reportFacts();
    clean(
      JSON.stringify(facts) + decodeURIComponent(issueUrl(facts) + mailtoUrl(facts)),
      'bug report',
    );
  });
});

describe('the vault is never an end of a link', () => {
  const vault = { module: 'accounts', id: 'entry-1' };
  const rawRow = (id: string, from: EntityLink['from'], to: EntityLink['to']) =>
    // As sync, a restore or an older copy would leave it: not through `addLink`.
    db.table(LINKS_TABLE).put({
      id,
      from,
      to,
      rel: 'about',
      label: 'Bank-Login',
      fromKey: `${from.module}:${from.id}`,
      toKey: `${to.module}:${to.id}`,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 'other',
      deletedAt: null,
      _f: {},
    });

  it('write: every writer refuses it as source and as target, and nothing is stored', async () => {
    const before = await db.table(LINKS_TABLE).count();
    const asTarget = { ...link, to: vault };
    const asSource = { ...link, from: vault };
    for (const bad of [asTarget, asSource]) {
      await expect(addLink(bad)).rejects.toThrow(/vault/);
      await expect(addLinkIfAbsent(bad)).rejects.toThrow(/vault/);
    }
    expect(await addLinksIfAbsent([asTarget, asSource])).toBe(0);
    expect(await db.table(LINKS_TABLE).count()).toBe(before);
    expect(JSON.stringify(await db.table(LINKS_TABLE).toArray())).not.toContain('accounts');
  });

  it('write: a module that is no link target is refused as well', async () => {
    expect(isLinkable('accounts')).toBe(false);
    expect(getManifest('accounts')?.contributions?.linkTarget).toBeUndefined();
    for (const module of ['habits', 'nosuchmodule', '']) {
      expect(isLinkable(module)).toBe(false);
      await expect(addLink({ ...link, to: { module, id: 'x' } })).rejects.toThrow();
    }
  });

  it('read: a row that arrived otherwise is dropped in both directions, from both ends', async () => {
    await rawRow('raw-to-vault', { module: 'todos', id: TASK }, vault);
    await rawRow('raw-from-vault', vault, { module: 'todos', id: TASK });
    await rawRow('raw-no-target', { module: 'todos', id: TASK }, { module: 'habits', id: 'h1' });
    await rawRow('raw-unknown', { module: 'nosuchmodule', id: 'x' }, { module: 'todos', id: TASK });

    const ofTask = await linksOf({ module: 'todos', id: TASK });
    expect(ofTask.map((l) => l.other.module).sort()).toEqual(['mail']);
    expect(JSON.stringify(ofTask)).not.toContain('Bank-Login');
    expect(await linkEntries(vault)).toEqual([]);
    expect(await linksOf(vault)).toEqual([]);
    expect(await linkEntries({ module: 'habits', id: 'h1' })).toEqual([]);
    for (const row of await db.table(LINKS_TABLE).where('id').startsWith('raw-').toArray())
      expect(readLink(row)).toBeUndefined();
  });

  it('migration: the copy of the ToDo links never writes a row into the vault', async () => {
    const tasks = createCollectionRepo(getManifest('todos')!, 'task');
    const t = await tasks.create({ listId: 'inbox', title: 'Bank', done: false, priority: 0 });
    // Stored links an app of today could not have written (the kinds are a closed list), as a pull leaves them.
    await db.table('todos_task').update(t.id, {
      links: [
        { kind: 'accounts', id: 'entry-1', label: 'Bank-Login' },
        { kind: 'account', id: 'entry-1', label: 'Bank-Login' },
        { kind: 'note', id: 'n1', label: 'Notiz' },
      ],
    });
    expect(await copyTodoLinks()).toBe(1);
    const stored = JSON.stringify(await db.table(LINKS_TABLE).toArray());
    expect(stored).not.toContain('accounts');
    expect(stored).not.toContain('Bank-Login');
    expect((await linkEntries({ module: 'todos', id: t.id })).map((l) => l.other.module)).toEqual([
      'notes',
    ]);
  });
});
