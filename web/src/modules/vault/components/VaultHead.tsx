import { HeroFigure, HeroSlot } from '@/ui/identity';
import { t } from '@/strings';
import { stateGroup, statusOf, type StateGroup } from '../logic';
import type { Stored } from '@/core/db/types';
import type { VaultDocument } from '../schema';

/**
 * Head of the documents (Identity 4.0): the count with one context line that names what needs a look. The states
 * are the page's tabs. Counts only; no title, file or date reaches the head.
 */
export function VaultHead({ docs, day }: { docs: Stored<VaultDocument>[]; day: string }) {
  if (docs.length === 0) return null;
  const groups = docs.map((d) => stateGroup(statusOf(d, day)));
  const count = (g: StateGroup) => groups.filter((x) => x === g).length;
  return (
    <HeroSlot area="figure">
      <HeroFigure
        label={t.vault.figureLabel}
        value={String(docs.length)}
        unit={t.vault.figureUnit}
        detail={t.vault.figureDetail(count('expired'), count('due')) || t.vault.widgetEmpty}
        testId="vault-total"
      />
    </HeroSlot>
  );
}
