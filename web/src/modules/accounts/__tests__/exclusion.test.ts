/**
 * The vault is invisible to the AI: no schema, no prompt text, no full-text hits, no executable
 * query – even with an unlocked vault full of entries.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ask } from '@/core/ai/assistant';
import { buildSchemaText, buildSystemPrompt, buildTools, schemaHash } from '@/core/ai/prompt';
import type { AiProvider, CompletionResult } from '@/core/ai/providers/types';
import { apiCollections, apiModules } from '@/core/dataapi/scope';
import { searchEntries } from '@/core/ai/search/fulltext';
import { clearAll, CORE_IDS, ctxFor, seed, TODAY, useFixedClock } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { allManifests, visibleManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import manifest from '../manifest';
import { resetAttempts, createVault, lockVault, saveEntry } from '../vault';

const FAST = { m: 64, t: 1, p: 1 };
const SECRET_TITLE = 'Streng-Geheimes-Bankkonto';
const SECRET_PASSWORD = 'Ultra-Geheimes-Passwort-42'; // gitleaks:allow (test fixture)

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  await db.table('accounts_vault').clear();
  await db.table('accounts_entry').clear();
  lockVault();
  resetAttempts();
  await seed();
  await createVault('Master-Passwort-Nr-1', FAST);
  await saveEntry({
    title: SECRET_TITLE,
    username: 'alice',
    password: SECRET_PASSWORD,
    notes: 'PIN 4711',
  });
});
afterAll(() => {
  setNow();
  lockVault();
});

const withAccounts = () => {
  const { manifests, known } = ctxFor(CORE_IDS);
  return { manifests: [...manifests, manifest], known: [...known, manifest] };
};

describe('module definition', () => {
  it('has no aiSchema, contributions for other modules, or quick add; one status-only widget', () => {
    expect(manifest.aiSchema).toBeUndefined();
    // not a trigger and not a target of automation rules
    expect(manifest.automation).toBeUndefined();
    expect(manifest.widgets.map((w) => w.id)).toEqual(['status']);
    const c = manifest.contributions ?? {};
    // only its own auto-lock service plus the (empty) onboarding declaration every module carries
    expect(Object.keys(c).sort()).toEqual(['onboarding', 'services']);
    expect(c.onboarding?.importers).toEqual([]);
    expect(c).not.toHaveProperty('calendarItems');
    expect(c).not.toHaveProperty('notifications');
    expect(c).not.toHaveProperty('quickAdd');
    expect(c).not.toHaveProperty('aiComputed');
    expect(c).not.toHaveProperty('aiCreateDefaults');
  });

  it('declares no `searchable` field anywhere (full-text index input), not even outside aiSchema', () => {
    // `searchable` only lives in `aiSchema.<collection>`; guard against it reappearing on the manifest
    // or on a collection definition under another path.
    const hasSearchable = (v: unknown, seen = new Set<unknown>()): boolean => {
      if (!v || typeof v !== 'object' || seen.has(v)) return false;
      seen.add(v);
      return Object.entries(v).some(([k, x]) => k === 'searchable' || hasSearchable(x, seen));
    };
    expect(hasSearchable(manifest.aiSchema)).toBe(false);
    expect(hasSearchable(manifest.dataSchema.collections)).toBe(false);
    expect(manifest).not.toHaveProperty('searchable');
  });

  it('is closed to the local API and the data API (single filter core/dataapi/scope.ts)', () => {
    // The local API (core/localapi/handler.ts) only serves apiModules(); the HTTP behaviour (404 like
    // an unknown module, no listing, no import) is pinned in core/localapi/localapi.test.ts and the
    // hard block in core/dataapi/dataapi.test.ts – this pins the manifest side.
    expect(manifest.dataApi).toBe(false);
    expect(apiCollections(manifest)).toEqual([]);
    expect(apiModules([manifest], { accounts: true })).toEqual([]);
    // the vault is closed even if a manifest tried to lift its opt-out
    expect(apiCollections({ ...manifest, dataApi: undefined })).toEqual([]);
  });

  it('status widget reads no entry data (source check) and never shows contents', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../widgets/StatusWidget.tsx', import.meta.url), 'utf8');
    for (const forbidden of ['entryRepo', 'useEntries', 'decryptRow', 'saveEntry', 'password']) {
      expect(src).not.toContain(forbidden);
    }
  });

  it('only offers its own setup step (no data, no AI, no widget)', () => {
    expect(manifest.setupSteps?.map((s) => s.id)).toEqual(['accounts.vault']);
    expect(manifest.aiSchema).toBeUndefined();
  });

  it('is registered, off by default, and one of only ten active manifests without aiSchema', () => {
    expect(allManifests.map((m) => m.id)).toContain('accounts');
    expect(visibleManifests.find((m) => m.id === 'accounts')?.defaultEnabled).toBe(false);
    // `browser` (what you read: history and bookmarks stay private), `downloads` (the jobs live in the native side, never in the data), `disk` (scan results and live system facts, never stored) and `chat` (conversations never reach the assistant) and `mail` (mail content never reaches a model), `music` (what you listen to stays on the device) and `weather` (live forecast data, nothing of yours) and `feeds` (what you subscribe to and read is personal) have none by design; `remote` (the phone as a remote control: holds no data, the PC's state lives in memory only) and `planner` (decision 1 of docs/decisions/plan.md: AI replanning is local-only, the plan, blocker labels and day notes describe the user's days and never reach the cloud, the search or the chat context) by decision; retired modules have none by definition. A new
    // module without one must be a decision.
    expect(allManifests.filter((m) => !m.aiSchema && !m.retired).map((m) => m.id)).toEqual([
      'accounts',
      'browser',
      'chat',
      'disk',
      'downloads',
      'feeds',
      'mail',
      'music',
      'planner',
      'remote',
      'weather',
    ]);
    expect(allManifests.filter((m) => m.retired).every((m) => !m.aiSchema)).toBe(true);
  });
});

describe('prompt and tools', () => {
  it('do not change or mention the module when it is enabled', () => {
    const { manifests } = ctxFor(CORE_IDS);
    const enabled = [...manifests, manifest];
    expect(buildSchemaText(enabled)).toBe(buildSchemaText(manifests));
    expect(buildSystemPrompt(enabled)).toBe(buildSystemPrompt(manifests));
    expect(JSON.stringify(buildTools(enabled))).toBe(JSON.stringify(buildTools(manifests)));
    expect(schemaHash(enabled)).toBe(schemaHash(manifests));
    const text = buildSystemPrompt(enabled) + JSON.stringify(buildTools(enabled));
    // (finance "accounts" = bank accounts appear in the rules text; the vault module id must not)
    for (const marker of ['"accounts"', '\naccounts:', 'accounts_entry', 'Tresor', 'Passwort']) {
      expect(text, marker).not.toContain(marker);
    }
  });
});

describe('search and answers', () => {
  it('full-text search never returns vault entries (unlocked vault)', async () => {
    const { manifests } = withAccounts();
    for (const q of [SECRET_TITLE, 'Bankkonto', 'alice', SECRET_PASSWORD, '4711']) {
      expect(await searchEntries(q, { manifests, database: db }), q).toEqual([]);
    }
  });

  it('the assistant answers short free text without vault hits', async () => {
    const res = await ask('Bankkonto', { ...withAccounts(), today: TODAY, database: db });
    expect(JSON.stringify(res)).not.toContain(SECRET_TITLE);
    expect(res).toMatchObject({ ok: true, result: { kind: 'rows', total: 0 } });
  });

  it('a model that asks for the vault gets "unknown module" – and nothing about it was sent', async () => {
    const complete = vi.fn(async (): Promise<CompletionResult> => ({
      toolCalls: [{ name: 'run_query', input: { module: 'accounts', collection: 'entry' } }],
      text: '',
      usage: { inputTokens: 1, outputTokens: 1 },
      model: 'm',
    }));
    const provider: AiProvider = { id: 'claude', model: 'm', complete };
    const res = await ask('Zeig mir bitte alle meine Zugangsdaten und Passwörter genau auf', {
      ...withAccounts(),
      today: TODAY,
      database: db,
      provider,
    });
    expect(res).toMatchObject({ ok: false, error: 'unknown-module' });
    const sent = JSON.stringify(complete.mock.calls);
    for (const secret of [
      SECRET_TITLE,
      SECRET_PASSWORD,
      'alice',
      '4711',
      '"accounts"',
      'accounts_entry',
    ]) {
      expect(sent.toLowerCase(), secret).not.toContain(secret.toLowerCase());
    }
  });
});

// Identity 4.0, package 0b-2: the palette and the quick capture are the entry points for adding things.
it('is no target of the palette or the phone plus: no quick-add entry, so no "Neu: …" command and the plus on /accounts stays the plain quick capture', async () => {
  const { isCredentialPath } = await import('@/core/text/credentialPath');
  // `useQuickAddActions` (palette "Neu: …", the sheet's "Weitere") and `usePlusTarget` (kind 'module') both read
  // `contributions.quickAdd`; without one the plus falls through to kind 'capture'.
  expect(manifest.contributions?.quickAdd).toBeUndefined();
  const actions = allManifests.flatMap((m) => m.contributions?.quickAdd ?? []);
  expect(actions.length).toBeGreaterThan(0);
  expect(actions.filter((a) => /^\/accounts(\/|\?|#|$)/.test(a.to))).toEqual([]);
  // The page declares no action of its own for the plus either (kind 'page').
  const { readdirSync, readFileSync } = await import('node:fs');
  const root = new URL('../', import.meta.url);
  const sources = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter(
    (f) => /\.tsx$/.test(f) && !f.includes('__tests__'),
  );
  expect(sources.length).toBeGreaterThan(0);
  for (const file of sources) {
    const src = readFileSync(new URL(file.replaceAll('\\', '/'), root), 'utf8');
    expect(src, file).not.toMatch(/\bPageAction\b/);
  }
  // Should a row ever lead there, the palette keeps the reading aid off it.
  expect(isCredentialPath('/accounts')).toBe(true);
});

it('is no hit of the palette: the live search over every module returns nothing of an unlocked vault', async () => {
  // The palette's own call (`useSearchHits`): five hits, all words must match.
  const manifests = [...visibleManifests];
  expect(manifests.map((m) => m.id)).toContain('accounts');
  for (const q of [SECRET_TITLE, 'Streng-Geheimes', 'alice', SECRET_PASSWORD, 'PIN 4711']) {
    const rows = await searchEntries(q, { manifests, database: db }, 5, false);
    expect(
      rows.filter((r) => r.to?.startsWith('/accounts')),
      q,
    ).toEqual([]);
    expect(JSON.stringify(rows), q).not.toContain(SECRET_TITLE);
    expect(JSON.stringify(rows), q).not.toContain(SECRET_PASSWORD);
  }
});

it('is no target of the quick capture: no capture type writes to it, whatever is typed, and a save leaves the vault alone', async () => {
  const { parseCapture } = await import('@/quickCapture/parser');
  const { TARGETS, availableTypes, saveCapture, targetFor } =
    await import('@/quickCapture/targets');
  expect(Object.values(TARGETS).map((target) => target.moduleId)).not.toContain('accounts');
  const allOn = Object.fromEntries(allManifests.map((m) => [m.id, true]));
  const types = availableTypes(allOn);
  expect(types.length).toBeGreaterThan(0);
  expect(types.map((type) => targetFor(type).moduleId)).not.toContain('accounts');

  const opts = {
    now: new Date(2026, 8, 29, 10, 0),
    fitness: { meal: true, workout: true },
    place: () => true,
  };
  const before = await db.table('accounts_entry').count();
  for (const line of [
    'Passwort Bank alice PIN 4711',
    'Login github.com Benutzer alice',
    'Zugangsdaten Streng-Geheimes-Bankkonto',
    'Tresor: neues Passwort für das Bankkonto',
  ]) {
    const parsed = parseCapture(line, opts);
    const reachable = [parsed.type, ...parsed.alternatives.map((a) => a.type)];
    expect(
      reachable.map((type) => targetFor(type).moduleId),
      line,
    ).not.toContain('accounts');
    if (!targetFor(parsed.type).requiresConfirm) {
      const saved = await saveCapture(parsed.type, parsed.fields, { states: allOn, database: db });
      expect(saved.moduleId, line).not.toBe('accounts');
    }
  }
  expect(await db.table('accounts_entry').count()).toBe(before);
  expect(await db.table('accounts_vault').count()).toBe(1);
});
