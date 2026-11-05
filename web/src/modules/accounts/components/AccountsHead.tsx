import { useEffect, useState } from 'react';
import { now } from '@/core/time/now';
import { HeroSlot, Signature } from '@/ui/identity';
import { t } from '@/strings';
import { getAutoLockDeadline } from '../autolock';
import styles from './AccountsHead.module.css';

/** Whole minutes (rounded up) until the idle lock fires; undefined when it is not armed. */
function useMinutesToLock(active: boolean): number | undefined {
  const [min, setMin] = useState<number>();
  useEffect(() => {
    if (!active) return;
    const read = () => {
      const at = getAutoLockDeadline();
      setMin(at === undefined ? undefined : Math.max(0, Math.ceil((at - now()) / 60_000)));
    };
    const first = setTimeout(read, 0);
    // Every few seconds is enough: the page never counts down second by second.
    const timer = setInterval(read, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active]);
  return active ? min : undefined;
}

/**
 * Head of the vault (`tresor`, identity v3.1): the door from the signature library at slot size S, the state beside
 * it in the same slot as plain text (one line on the phone too) and, while unlocked, when the idle lock fires. Shows nothing about the content.
 */
export function AccountsHead({ unlocked }: { unlocked: boolean }) {
  const min = useMinutesToLock(unlocked);
  return (
    <HeroSlot area="signature">
      <Signature id="vaultDoor" size="S" />
      <p className={styles.text} data-testid="vault-door" data-state={unlocked ? 'open' : 'shut'}>
        <span className={styles.state}>
          {unlocked ? t.accounts.head.unlocked : t.accounts.head.locked}
        </span>
        {unlocked && min !== undefined ? (
          <span className={styles.sub}>{t.accounts.head.autoLock(min)}</span>
        ) : null}
      </p>
    </HeroSlot>
  );
}
