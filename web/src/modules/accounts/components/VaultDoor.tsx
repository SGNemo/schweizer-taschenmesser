import { useEffect, useState } from 'react';
import { now } from '@/core/time/now';
import { HeroSlot } from '@/ui/identity';
import { t } from '@/strings';
import { getAutoLockDeadline } from '../autolock';
import styles from './VaultDoor.module.css';

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
 * Signature "vault door": a door that is shut when locked and ajar when unlocked, with the state as plain text and,
 * while unlocked, when the idle lock fires. The door is decoration and never moves; it shows nothing about the content.
 */
export function VaultDoor({ unlocked }: { unlocked: boolean }) {
  const min = useMinutesToLock(unlocked);
  return (
    <HeroSlot>
      <div className={styles.door} data-testid="vault-door" data-state={unlocked ? 'open' : 'shut'}>
        <span className={styles.frame} aria-hidden="true">
          <span className={styles.leaf}>
            <span className={styles.knob} />
          </span>
        </span>
        <span className={styles.text}>
          <span className={styles.state}>
            {unlocked ? t.accounts.head.unlocked : t.accounts.head.locked}
          </span>
          {unlocked && min !== undefined ? (
            <span className={styles.sub}>{t.accounts.head.autoLock(min)}</span>
          ) : null}
        </span>
      </div>
    </HeroSlot>
  );
}
