import { HeroFigure, HeroSlot } from '@/ui/identity';
import { Icon } from '@/ui';
import { t } from '@/strings';
import { statusOf } from '../logic';
import type { Stored } from '@/core/db/types';
import type { VaultDocument } from '../schema';
import styles from './VaultHead.module.css';

/**
 * Head of the documents (`regal`): the count with one context line (expired, deadlines ahead) and a plate that says
 * where the files live. Counts only; no title, file or date reaches the head.
 */
export function VaultHead({ docs, day }: { docs: Stored<VaultDocument>[]; day: string }) {
  if (docs.length === 0) return null;
  const states = docs.map((d) => statusOf(d, day));
  const expired = states.filter((s) => s === 'expired').length;
  const due = states.filter((s) => s === 'act-now' || s === 'soon' || s === 'missed').length;
  return (
    <>
      <HeroSlot area="figure">
        <HeroFigure
          label={t.vault.figureLabel}
          value={String(docs.length)}
          unit={t.vault.figureUnit}
          detail={t.vault.figureDetail(expired, due) || t.vault.widgetEmpty}
          testId="vault-total"
        />
      </HeroSlot>
      <HeroSlot>
        <p className={styles.plate} data-testid="vault-local">
          <Icon name="lock" size={16} />
          <span>{t.vault.localOnly}</span>
        </p>
      </HeroSlot>
    </>
  );
}
