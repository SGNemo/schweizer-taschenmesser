import { useEffect, useState } from 'react';
import { now } from '@/core/time/now';
import { Button, Icon } from '@/ui';
import { HeroSlot, Signature } from '@/ui/identity';
import { t } from '@/strings';
import { getPlatform } from '@/core/platform';
import { useBridgeConfig } from '@/core/vaultbridge/config';
import { getAutoLockDeadline } from '../autolock';
import { lockVault } from '../vault';
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
 * it in the same slot as plain text (one line on the phone too) and, while unlocked, when the idle lock fires and the
 * button that locks at once. Shows nothing about the content.
 */
export function AccountsHead({ unlocked }: { unlocked: boolean }) {
  const min = useMinutesToLock(unlocked);
  // The browser extension is a channel into the open vault: while it is on, the page says so beside the state.
  const bridge = useBridgeConfig();
  const bridgeOn = getPlatform().vaultBridge.supported && bridge?.enabled === true;
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
        {unlocked && bridgeOn ? (
          <span className={styles.sub} data-testid="bridge-state">
            {t.accounts.head.bridgeOn}
          </span>
        ) : null}
      </p>
      {/* Locking is one click from anywhere on the page, beside the state it changes: never inside a menu. */}
      {unlocked ? (
        <Button size="sm" onClick={lockVault}>
          <Icon name="lock" size={16} />
          {t.accounts.lock.lockNow}
        </Button>
      ) : null}
    </HeroSlot>
  );
}
