import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { ask, type AskDeps } from '../assistant';
import {
  AiError,
  type AiProvider,
  type CompletionRequest,
  type CompletionResult,
} from '../providers/types';
import { clearAll, ctxFor, seed, TODAY, useFixedClock } from '../testing';
import { loadUsageRows, totalsByStage } from '../usage';
import { commitOps, undoGroup } from './commit';
import { prepareProposal } from './prepare';
import { detectIntent } from './rules/intent';
import { parseWrite } from './rules/parse';
import { matchScore } from './targets';
import type { WriteSettings } from './stages';
import manifestAccounts from '@/modules/accounts/manifest';

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  await db.table('_imports').clear();
  await seed();
});
afterAll(() => setNow());

const WRITE: WriteSettings = { enabled: true, modulesOff: [], cloud: true, askMissing: true };

function provider(result?: CompletionResult): AiProvider & { complete: ReturnType<typeof vi.fn> } {
  return {
    id: 'claude',
    model: 'claude-haiku-4-5',
    complete: vi.fn(async (_req: CompletionRequest) => {
      if (!result) throw new Error('the model must not be called');
      return result;
    }),
  };
}

const proposeCall = (input: unknown): CompletionResult => ({
  toolCalls: [{ name: 'propose_actions', input }],
  text: '',
  usage: { inputTokens: 600, outputTokens: 40 },
  model: 'claude-haiku-4-5-20251001',
});

const deps = (over: Partial<AskDeps> = {}): AskDeps => {
  const { manifests, known } = ctxFor();
  return { manifests, known, today: TODAY, database: db, write: WRITE, ...over };
};

const count = async (table: string): Promise<number> =>
  (await db.table(table).toArray()).filter((r) => r.deletedAt === null).length;

describe('stage 0: rules answer for free', () => {
  it('turns a sentence into a preview without the model and without writing', async () => {
    const p = provider();
    const before = await count('invoices_invoice');
    const res = await ask('Rechnung Stadtwerke 89,90 € fällig 15.10.', deps({ provider: p }));
    expect(res).toMatchObject({ ok: true, tier: 'rule', result: { kind: 'write', stage: 'rule' } });
    if (!res.ok || res.result.kind !== 'write') throw new Error('expected a write result');
    expect(res.result.ops[0]).toMatchObject({
      module: 'invoices',
      kind: 'create',
      ready: true,
      data: { payee: 'Stadtwerke', amountMinor: 8990, dueDate: '2026-10-15', status: 'open' },
    });
    expect(p.complete).not.toHaveBeenCalled();
    expect(await count('invoices_invoice')).toBe(before); // nothing is stored by the preview
  });

  it('records rule answers with zero tokens and counts them per stage', async () => {
    await ask('Rechnung Stadtwerke 89,90 € fällig 15.10.', deps({ provider: provider() }));
    const stages = totalsByStage(await loadUsageRows(db));
    expect(stages.rule.answers).toBe(1);
    expect(stages.rule.inputTokens + stages.rule.outputTokens).toBe(0);
    expect(stages.cloud.answers).toBe(0);
  });

  it('asks for missing required fields in the preview instead of calling the model', async () => {
    const p = provider();
    const res = await ask('Rechnung Stadtwerke 89,90 €', deps({ provider: p }));
    if (!res.ok || res.result.kind !== 'write') throw new Error('expected a write result');
    expect(res.result.ops[0]).toMatchObject({ ready: false, missing: ['dueDate'] });
    expect(p.complete).not.toHaveBeenCalled();
  });

  it('does not propose such sentences when asking is switched off', async () => {
    const res = await ask(
      'Rechnung Stadtwerke 89,90 €',
      deps({ provider: undefined, write: { ...WRITE, askMissing: false } }),
    );
    expect(res).toMatchObject({ ok: true, tier: 'local', hint: 'no-model' });
  });

  it('respects the global and the per-module switch', async () => {
    const sentence = 'Rechnung Stadtwerke 89,90 € fällig 15.10.';
    const off = await ask(
      sentence,
      deps({ provider: undefined, write: { ...WRITE, enabled: false } }),
    );
    expect(off).toMatchObject({ ok: true, hint: 'no-model' });
    const moduleOff = await ask(
      sentence,
      deps({ provider: undefined, write: { ...WRITE, modulesOff: ['invoices'] } }),
    );
    expect(moduleOff).toMatchObject({ ok: true, hint: 'no-model' });
  });

  it('keeps plain questions and searches out of the write path', async () => {
    for (const q of [
      'Was steht heute an?',
      'Netflix',
      'Rechnung Stadtwerke',
      'Zeige alle Rechnungen',
    ]) {
      const res = await ask(q, deps({ provider: provider() }));
      expect(res.ok && res.result.kind === 'write', q).toBe(false);
    }
    expect(detectIntent('Rechnung Stadtwerke 89,90 € fällig 15.10.', ctxFor().manifests)).toBe(
      'write',
    );
    expect(detectIntent('Wie viel kostet mein Abo?', ctxFor().manifests)).toBe('question');
    expect(detectIntent('Netflix', ctxFor().manifests)).toBe('search');
  });
});

describe('stage 2: the cloud is the last resort', () => {
  const SENTENCE = 'Leg bitte etwas für die Steuerberaterin fest, sie meldet sich Freitag';

  it('is asked only when rules cannot place the sentence, with schema + date + text only', async () => {
    const p = provider(
      proposeCall({
        ops: [
          {
            module: 'calendar',
            action: 'create',
            data: { title: 'Steuerberaterin', startDate: '2026-10-02', kind: 'reminder' },
          },
        ],
      }),
    );
    const res = await ask(SENTENCE, deps({ provider: p }));
    expect(p.complete).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({
      ok: true,
      tier: 'model',
      result: { kind: 'write', stage: 'cloud' },
    });

    const req = p.complete.mock.calls[0]![0] as CompletionRequest;
    const sent = JSON.stringify(req);
    expect(req.tools.map((t) => t.name)).toContain('propose_actions');
    expect(req.tools.map((t) => t.name)).not.toContain('create_entry');
    expect(sent).toContain(SENTENCE);
    expect(sent).toContain(TODAY);
    // No stored entry (titles, payees, notes) ever reaches the cloud.
    for (const secret of ['Geheimfirma', 'Sonnenschein', 'Milch kaufen', 'Altes erledigt']) {
      expect(sent).not.toContain(secret);
    }
    const rows = await loadUsageRows(db);
    expect(totalsByStage(rows).cloud.answers).toBe(1);
  });

  it('is not offered writes when the user switched cloud writes off', async () => {
    const p = provider(
      proposeCall({ ops: [{ module: 'todos', action: 'create', data: { title: 'x' } }] }),
    );
    await ask(SENTENCE, deps({ provider: p, write: { ...WRITE, cloud: false } }));
    const req = p.complete.mock.calls[0]![0] as CompletionRequest;
    expect(req.tools.map((t) => t.name)).not.toContain('propose_actions');
    expect(req.tools.map((t) => t.name)).not.toContain('create_entry');
  });

  it('turns an update proposal into a before/after diff for the right entry', async () => {
    const p = provider(
      proposeCall({
        ops: [
          {
            module: 'todos',
            action: 'update',
            target: { title: 'Steuererklärung' },
            data: { dueDate: '2026-10-20' },
          },
        ],
      }),
    );
    const res = await ask(SENTENCE, deps({ provider: p }));
    if (!res.ok || res.result.kind !== 'write') throw new Error('expected a write result');
    const op = res.result.ops[0]!;
    expect(op).toMatchObject({
      kind: 'update',
      targetTitle: 'Steuererklärung Geheimfirma',
      ready: true,
    });
    expect(op.lines[0]).toMatchObject({
      field: 'dueDate',
      from: expect.stringContaining('2026'),
      to: expect.stringContaining('2026'),
    });
  });

  it('reports a rate limit or an abort instead of writing anything', async () => {
    for (const code of ['rate-limit', 'aborted'] as const) {
      const p: AiProvider = {
        id: 'claude',
        model: 'claude-haiku-4-5',
        complete: vi.fn(async () => {
          throw new AiError(code, code);
        }),
      };
      const before = await count('todos_task');
      const res = await ask(SENTENCE, deps({ provider: p }));
      expect(res).toMatchObject({ ok: false, error: code });
      expect(await count('todos_task')).toBe(before);
    }
  });

  it('rejects a malformed answer so the router can try the next provider', async () => {
    const p = provider(proposeCall({ ops: 'nope' }));
    const res = await ask(SENTENCE, deps({ provider: p }));
    expect(res).toMatchObject({ ok: false });
  });
});

describe('targets, changes and deletions', () => {
  const ctx = () => ({ ...ctxFor(), manifests: ctxFor().manifests });
  const rules = () => ({
    manifests: ctx().manifests,
    database: db,
    now: new Date(2026, 8, 29, 10, 0),
    today: TODAY,
  });

  it('matches typos, prefixes and umlauts', () => {
    expect(matchScore('stadtwerk', 'Stadtwerke Strom')).toBeGreaterThanOrEqual(0.8);
    expect(matchScore('steuererklaerung', 'Steuererklärung Geheimfirma')).toBeGreaterThan(0.5);
    expect(matchScore('zahnartz', 'Zahnarzt Dr. Sonnenschein')).toBeGreaterThanOrEqual(0.8);
    expect(matchScore('netflix', 'Spotify')).toBe(0);
  });

  it('shows what a deletion removes and undoes it', async () => {
    const proposal = await parseWrite('Lösche die Aufgabe Milch kaufen', rules());
    expect(proposal?.ops[0]).toMatchObject({ module: 'todos', action: 'delete' });
    const [op] = await prepareProposal(proposal!.ops, ctx());
    expect(op).toMatchObject({ kind: 'delete', targetTitle: 'Milch kaufen', ready: true });
    expect(op!.lines.length).toBeGreaterThan(0);

    const before = await count('todos_task');
    const done = await commitOps([op!], { manifests: ctx().known, source: 'test' });
    expect(await count('todos_task')).toBe(before - 1);
    await undoGroup(done.groupId, { manifests: ctx().known });
    expect(await count('todos_task')).toBe(before);
  });

  it('does not overwrite an entry that changed after the preview', async () => {
    const proposal = await parseWrite('Verschiebe die Aufgabe Milch kaufen auf 5.10.', rules());
    const [op] = await prepareProposal(proposal!.ops, ctx());
    expect(op).toMatchObject({ kind: 'update', ready: true });
    // Someone edits the task between preview and confirmation.
    const { taskRepo } = await import('@/modules/todos/repo');
    await taskRepo.update(op!.targetId!, { dueDate: '2026-12-01' });
    const done = await commitOps([op!], { manifests: ctx().known, source: 'test' });
    expect(done.conflicts).toBe(1);
    expect(done.written).toBe(0);
  });

  it('asks which entry is meant when two match equally', async () => {
    const { taskRepo } = await import('@/modules/todos/repo');
    await taskRepo.create({
      listId: 'inbox',
      title: 'Milch kaufen im Bioladen',
      done: false,
      priority: 0,
      order: 0,
    });
    const proposal = await parseWrite('Lösche die Aufgabe Milch', rules());
    const [op] = await prepareProposal(proposal!.ops, ctx());
    expect(op!.ready).toBe(false);
    expect(op!.needsTarget).toBe(true);
    expect(op!.candidates.length).toBe(2);
  });

  it('writes several entries from one input', async () => {
    const proposal = await parseWrite('Aufgabe Zahnarzt anrufen\nAufgabe Pakete abholen', rules());
    expect(proposal?.ops.map((o) => o.data?.title)).toEqual(['Zahnarzt anrufen', 'Pakete abholen']);
  });
});

describe('the vault is out of reach', () => {
  it('has no schema, action, prompt text or target in the write path', async () => {
    const { manifests, known } = ctxFor();
    const withVault = {
      manifests: [...manifests, manifestAccounts],
      known: [...known, manifestAccounts],
    };
    const p = provider(
      proposeCall({ ops: [{ module: 'accounts', action: 'delete', target: { title: 'x' } }] }),
    );
    const res = await ask('Lösche den Tresor-Eintrag Bank', {
      ...deps({ provider: p }),
      ...withVault,
    });
    const req = p.complete.mock.calls[0]?.[0] as CompletionRequest | undefined;
    if (req) {
      const sent = JSON.stringify(req);
      expect(sent).not.toContain('"accounts"'); // not in any module enum
      expect(sent).not.toMatch(/\\naccounts:/); // not in the schema or action text
    }
    // A model asking for it anyway is rejected by the executor.
    if (res.ok && res.result.kind === 'write') throw new Error('the vault must not be writable');
  });
});
