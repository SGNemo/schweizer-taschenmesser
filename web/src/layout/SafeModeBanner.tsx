import { isSafeMode, isSafeModeForced } from '@/core/safemode/safeMode';
import { tDiag } from '@/strings.diagnostics';
import { Button } from '@/ui';
import styles from './SafeModeBanner.module.css';

/** Always visible in safe mode so it is never mistaken for an empty app. */
export function SafeModeBanner() {
  const d = tDiag.use().safe;
  if (!isSafeMode()) return null;
  return (
    <div className={styles.banner} role="status" data-testid="safe-mode-banner">
      <span>{d.banner}</span>
      {isSafeModeForced() ? (
        <span>{d.leaveForced}</span>
      ) : (
        <Button onClick={() => location.reload()}>{d.leave}</Button>
      )}
    </div>
  );
}
