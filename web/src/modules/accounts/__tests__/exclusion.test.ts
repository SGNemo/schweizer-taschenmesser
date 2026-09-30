/**
 * The vault is invisible to the AI: no schema, no prompt text, no full-text hits, no executable
 * query – even with an unlocked vault full of entries.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ask } from '@/core/ai/assistant';
import { buildSchemaText, buildSystemPrompt, buildTools, schemaHash } from '@/core/ai/prompt';
import type { AiProvider, CompletionResult } from '@/core/ai/providers/types';
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
  it('has no aiSchema, widgets, contributions for other modules, or quick add', () => {
    expect(manifest.aiSchema).toBeUndefined();
    expect(manifest.widgets).toEqual([]);
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

  it('only offers its own setup step (no data, no AI, no widget)', () => {
    expect(manifest.setupSteps?.map((s) => s.id)).toEqual(['accounts.vault']);
    expect(manifest.aiSchema).toBeUndefined();
  });

  it('is registered, off by default, and one of only three manifests without aiSchema', () => {
    expect(allManifests.map((m) => m.id)).toContain('accounts');
    expect(visibleManifests.find((m) => m.id === 'accounts')?.defaultEnabled).toBe(false);
    // `news` (public third-party text) and `launcher` (a list of links) have none by design; a new module without one must be a decision.
    expect(allManifests.filter((m) => !m.aiSchema).map((m) => m.id)).toEqual([
      'accounts',
      'launcher',
      'news',
    ]);
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
