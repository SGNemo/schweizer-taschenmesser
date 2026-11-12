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
 * The browser extension is a channel into the open vault: while it is connected, the page says so beside the state.
 * Mounted only while the vault is open, so a locked page reads nothing about the bridge.
 */
function BridgeLine() {
  const bridge = useBridgeConfig();
  if (!getPlatform().vaultBridge.supported || bridge?.enabled !== true) return null;
  return (
    <p className={styles.sub} data-testid="bridge-state">
      {t.accounts.head.bridgeOn}
    </p>
  );
}

/**
 * Head of the vault (`tresor`, identity v3.1): the door from the signature library at slot size S, the state beside
 * it in the same slot as plain text (one line on the phone too) and, while unlocked, when the idle lock fires and the
 * button that locks at once. Shows nothing about the content.
 */
export function AccountsHead({ unlocked }: { unlocked: boolean }) {
  const min = useMinutesToLock(unlocked);
  return (
    <HeroSlot area="signature">
      <Signature id="vaultDoor" size="S" />
      {/* Each line is its own paragraph: a screen reader reads three sentences, not one. */}
      <div className={styles.text} data-testid="vault-door" data-state={unlocked ? 'open' : 'shut'}>
        <p className={styles.state}>
          {unlocked ? t.accounts.head.unlocked : t.accounts.head.locked}
        </p>
        {unlocked && min !== undefined ? (
          <p className={styles.sub}>{t.accounts.head.autoLock(min)}</p>
        ) : null}
        {unlocked ? <BridgeLine /> : null}
      </div>
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
