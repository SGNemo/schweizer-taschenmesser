import { FolderTabs } from '@/ui';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { t } from '@/strings';
import { STATE_GROUPS, stateGroup, statusOf, type StateGroup } from '../logic';
import type { Stored } from '@/core/db/types';
import type { VaultDocument } from '../schema';

/**
 * Head of the documents (`regal`, identity v3.1 G03): the count with one context line, and the folder tabs with a
 * count per state in slot M. The tabs filter the list (a tap on the chosen one shows all again). Counts only; no
 * title, file or date reaches the head.
 */
export function VaultHead({
  docs,
  day,
  state,
  onState,
}: {
  docs: Stored<VaultDocument>[];
  day: string;
  state: StateGroup | null;
  onState: (next: StateGroup | null) => void;
}) {
  if (docs.length === 0) return null;
  const groups = docs.map((d) => stateGroup(statusOf(d, day)));
  const count = (g: StateGroup) => groups.filter((x) => x === g).length;
  return (
    <>
      <HeroSlot area="figure">
        <HeroFigure
          label={t.vault.figureLabel}
          value={String(docs.length)}
          unit={t.vault.figureUnit}
          detail={t.vault.figureDetail(count('expired'), count('due')) || t.vault.widgetEmpty}
          testId="vault-total"
        />
      </HeroSlot>
      <HeroSlot area="signature">
        <FolderTabs
          testId="vault-state-tabs"
          label={t.vault.stateTabs}
          value={state ?? ''}
          onChange={(id) => onState(id === state ? null : (id as StateGroup))}
          tabs={STATE_GROUPS.map((g) => ({
            id: g,
            label: `${count(g)} ${t.vault.stateGroups[g]}`,
          }))}
        />
      </HeroSlot>
    </>
  );
}
