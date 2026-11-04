/**
 * Runs the actions of a rule. Entry actions go through the same contract as the assistant
 * (`aiSchema.actions`, checked by `prepareOp`, written as an import batch with the run's group id),
 * so the vault and every module without an `aiSchema` is out of reach, deletes are refused and the
 * run can be undone as one group. Nothing here sends anything or deletes anything.
 */
import { commitOps } from '@/core/ai/write/commit';
import { prepareOp } from '@/core/ai/write/prepare';
import type { PreparedOp, ProposedOp } from '@/core/ai/write/types';
import type { TaschenmesserDB } from '@/core/db/db';
import { clearFocusSession, getFocusSession, saveFocusSession } from '@/core/focus/state';
import { startSession } from '@/core/focus/session';
import type { ModuleManifest } from '@/core/modules/types';
import {
  applyProfile,
  builtinProfiles,
  lastAppliedProfileId,
  loadCustomProfiles,
} from '@/core/settings/profiles';
import { fillAll, fillText } from './template';
import type { ActionOutcome } from './log';
import { addNotice } from './notices';
import { readKv, writeKv } from './kv';
import { EXCLUDED_MODULES, type Action, type AutomationEvent, type Rule } from './types';

export const AUTOMATION_IMPORTER_ID = 'automation';

export interface RunContext {
  rule: Rule;
  event: AutomationEvent;
  groupId: string;
  at: number;
  today: string;
  dryRun: boolean;
  manifests: readonly ModuleManifest[];
  known: readonly ModuleManifest[];
  database: TaschenmesserDB;
  allowed?: (module: string, action: string) => boolean;
}

/** 64-bit-ish id part from text (FNV-1a twice); only has to be stable, not secret. */
export function stableId(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b + c, 0x85ebca6b) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

const proposal = (
  a: Extract<Action, { kind: 'entry' | 'suggest' }>,
  event: AutomationEvent,
): ProposedOp => ({
  module: a.module,
  action: a.action,
  data: fillAll(a.data, event),
  ...(a.kind === 'entry' && a.target
    ? {
        target: {
          ...(a.target.id ? { id: fillText(a.target.id, event) } : {}),
          ...(a.target.title ? { title: fillText(a.target.title, event) } : {}),
        },
      }
    : {}),
});

async function prepare(
  a: Extract<Action, { kind: 'entry' | 'suggest' }>,
  index: number,
  ctx: RunContext,
): Promise<PreparedOp | ActionOutcome> {
  const base = { kind: a.kind, module: a.module, ok: false };
  if (EXCLUDED_MODULES.includes(a.module)) return { ...base, note: 'not-allowed' };
  if (!ctx.manifests.some((m) => m.id === a.module)) return { ...base, note: 'module-unavailable' };
  if (ctx.allowed && !ctx.allowed(a.module, a.action)) return { ...base, note: 'not-allowed' };
  let op: PreparedOp;
  try {
    op = await prepareOp(proposal(a, ctx.event), index, {
      manifests: ctx.manifests,
      known: ctx.known,
      database: ctx.database,
      today: ctx.today,
    });
  } catch (e) {
    return { ...base, note: e instanceof Error && 'code' in e ? String(e.code) : 'invalid' };
  }
  if (op.kind === 'delete') return { ...base, note: 'not-allowed' };
  if (!op.ready) return { ...base, note: op.needsTarget ? 'no-target' : 'incomplete' };
  return op;
}

const isOutcome = (x: PreparedOp | ActionOutcome): x is ActionOutcome => 'ok' in x;

async function runOne(a: Action, index: number, ctx: RunContext): Promise<ActionOutcome> {
  switch (a.kind) {
    case 'entry': {
      const op = await prepare(a, index, ctx);
      if (isOutcome(op)) return op;
      if (ctx.dryRun) return { kind: 'entry', module: a.module, ok: true, note: 'dry' };
      const result = await commitOps([op], {
        manifests: ctx.manifests,
        source: ctx.rule.title,
        database: ctx.database,
        writer: {
          importerId: AUTOMATION_IMPORTER_ID,
          origin: 'automation',
          groupId: ctx.groupId,
          idFor: () => `auto-${stableId(`${ctx.rule.id}|${ctx.event.key}|${index}`)}`,
        },
      });
      return {
        kind: 'entry',
        module: a.module,
        ok: true,
        written: result.written,
        ...(result.written === 0
          ? { note: 'exists' }
          : result.conflicts
            ? { note: 'conflict' }
            : {}),
      };
    }
    case 'suggest': {
      const op = await prepare(a, index, ctx);
      if (isOutcome(op)) return op;
      if (ctx.dryRun) return { kind: 'suggest', module: a.module, ok: true, note: 'dry' };
      await addNotice(
        {
          id: `${ctx.groupId}-${index}`,
          groupId: ctx.groupId,
          ruleId: ctx.rule.id,
          at: ctx.at,
          title: String(op.targetTitle ?? op.data.title ?? op.data.name ?? op.actionLabel),
          suggestion: proposal(a, ctx.event),
        },
        ctx.database,
      );
      return { kind: 'suggest', module: a.module, ok: true };
    }
    case 'reminder':
    case 'notice': {
      if (ctx.dryRun) return { kind: a.kind, ok: true, note: 'dry' };
      const delay = a.kind === 'reminder' ? (a.inMinutes ?? 0) * 60_000 : 0;
      await addNotice(
        {
          id: `${ctx.groupId}-${index}`,
          groupId: ctx.groupId,
          ruleId: ctx.rule.id,
          at: ctx.at + delay,
          title: fillText(a.title, ctx.event),
          ...(a.body ? { body: fillText(a.body, ctx.event) } : {}),
          ...(a.url ? { url: a.url } : {}),
        },
        ctx.database,
      );
      return { kind: a.kind, ok: true };
    }
    case 'focus': {
      if (ctx.dryRun) return { kind: 'focus', ok: true, note: 'dry' };
      const running = await getFocusSession();
      if (running) return { kind: 'focus', ok: true, note: 'busy' };
      await saveFocusSession(
        startSession(
          { id: `auto-${ctx.groupId}`, title: fillText(a.title, ctx.event) },
          a.minutes,
          ctx.at,
        ),
      );
      return { kind: 'focus', ok: true };
    }
    case 'profile': {
      const all = [...builtinProfiles(), ...(await loadCustomProfiles())];
      const profile = all.find((p) => p.id === a.profileId);
      if (!profile) return { kind: 'profile', ok: false, note: 'unknown-profile' };
      if (ctx.dryRun) return { kind: 'profile', ok: true, note: 'dry' };
      await writeKv(
        ctx.database,
        `automation.profile.${ctx.groupId}`,
        lastAppliedProfileId() ?? null,
      );
      await applyProfile(profile, 'schedule');
      return { kind: 'profile', ok: true };
    }
  }
}

/** Runs all actions in order; one failing action does not stop the others. */
export async function runActions(ctx: RunContext): Promise<ActionOutcome[]> {
  const out: ActionOutcome[] = [];
  for (const [i, a] of ctx.rule.actions.entries()) {
    try {
      out.push(await runOne(a, i, ctx));
    } catch {
      out.push({ kind: a.kind, ok: false, note: 'error' });
    }
  }
  return out;
}

/** Undo parts that are not entries: a focus round this run started, the profile before the switch. */
export async function undoSideEffects(groupId: string, database: TaschenmesserDB): Promise<void> {
  const session = await getFocusSession();
  if (session?.taskId === `auto-${groupId}`) await clearFocusSession();
  const key = `automation.profile.${groupId}`;
  const before = await readKv<string | null>(database, key);
  if (before) {
    const all = [...builtinProfiles(), ...(await loadCustomProfiles())];
    const profile = all.find((p) => p.id === before);
    if (profile) await applyProfile(profile, 'manual');
  }
}
