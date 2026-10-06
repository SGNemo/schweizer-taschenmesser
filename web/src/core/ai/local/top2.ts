/**
 * "Second reading" of a sentence for the two-suggestions idea (measured by
 * `npm run ai:eval -- --top2`; not used by the app yet). Instead of asking the model for two answers
 * in one go (small models leave the second one empty), the same prompt is run a second time with a
 * grammar that no longer allows the module/action pair of the first answer. The model then has to
 * choose another reading; with the prompt prefix cached this costs one short generation.
 */
import type { ModuleManifest } from '@/core/modules/types';
import type { WriteProposal } from '../write/types';
import { buildGrammar } from './grammar';

/** The writable modules without the actions used by `first` (modules left without any action vanish). */
export function withoutActions(
  writable: readonly ModuleManifest[],
  first: Pick<WriteProposal, 'ops'>,
): ModuleManifest[] {
  const used = new Set(first.ops.map((o) => `${o.module}.${o.action}`));
  return writable
    .map((m) => {
      const actions = Object.fromEntries(
        Object.entries(m.aiSchema!.actions ?? {}).filter(([id]) => !used.has(`${m.id}.${id}`)),
      );
      return { ...m, aiSchema: { ...m.aiSchema!, actions } } as ModuleManifest;
    })
    .filter((m) => Object.keys(m.aiSchema!.actions ?? {}).length > 0);
}

/** Grammar for the second reading, or `undefined` when nothing else is left to choose. */
export function secondGrammar(
  writable: readonly ModuleManifest[],
  first: Pick<WriteProposal, 'ops'>,
): string | undefined {
  const rest = withoutActions(writable, first);
  return rest.length > 0 ? buildGrammar(rest) : undefined;
}
