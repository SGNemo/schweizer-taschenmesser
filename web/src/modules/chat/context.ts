/**
 * Optional context for a question: data of modules the user allowed for this chat. It is the
 * answer of the local query layer (rules only – no model, no tokens) to the question, turned into
 * short text. The user sees exactly this text before it is sent; with a cloud engine it is part of
 * the message, with the local model it stays on the device. The password vault never takes part
 * (modules without `aiSchema` do not exist for the assistant).
 */
import { ask } from '@/core/ai/assistant';
import { aiModules } from '@/core/ai/scope';
import type { AiResult } from '@/core/ai/query/types';
import type { ModuleManifest } from '@/core/modules/types';

/** Longest context in characters (about 700 tokens). */
export const MAX_CONTEXT_CHARS = 2000;

/** Modules a chat may offer for context: enabled and with an `aiSchema`. */
export function contextModules(manifests: readonly ModuleManifest[]): ModuleManifest[] {
  return aiModules(manifests);
}

export function resultToText(result: AiResult): string {
  switch (result.kind) {
    case 'rows':
      return [
        `${result.heading} (${result.total})`,
        ...result.rows.map(
          (r) =>
            `- ${r.title}${r.fields.length ? ` · ${r.fields.map((f) => `${f.label}: ${f.value}`).join(', ')}` : ''}`,
        ),
      ].join('\n');
    case 'aggregate':
      return `${result.heading}: ${result.value}${result.note ? ` (${result.note})` : ''}`;
    case 'agenda':
      return [
        `${result.from} bis ${result.to}`,
        ...result.items.map((i) => `- ${i.date} ${i.title}`),
      ].join('\n');
    case 'computed':
      return [result.title, ...result.lines.map((l) => `- ${l.label}: ${l.value}`)].join('\n');
    case 'message':
      return result.text;
    default:
      return ''; // proposals are never context
  }
}

export interface ContextDeps {
  manifests: readonly ModuleManifest[];
  known: readonly ModuleManifest[];
  today: string;
}

/**
 * Local answer to the question from the allowed modules only; `undefined` when nothing matched.
 * Never calls a provider and never writes.
 */
export async function buildContext(
  question: string,
  allowed: readonly string[],
  deps: ContextDeps,
): Promise<string | undefined> {
  const manifests = contextModules(deps.manifests).filter((m) => allowed.includes(m.id));
  if (manifests.length === 0) return undefined;
  const response = await ask(question, {
    manifests,
    known: manifests,
    today: deps.today,
    provider: undefined,
  });
  if (!response.ok) return undefined;
  const text = resultToText(response.result).trim();
  if (!text) return undefined;
  return text.length > MAX_CONTEXT_CHARS ? `${text.slice(0, MAX_CONTEXT_CHARS)} …` : text;
}
