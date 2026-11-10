import { useState } from 'react';
import { loadSeed } from '@/core/seed/load';
import { tDev } from '@/strings.dev';
import { Button } from '@/ui';
import styles from './WelcomeCard.module.css';

/**
 * Dev-Preview only (lazy via `layout/devTools.ts`): the welcome card of an empty app offers test data
 * as a choice next to "Einrichtung starten" instead of filling the app by itself (A10, round 5).
 * Loading marks the setup as done and shows the seed banner, so the card goes away on its own.
 */
export default function TestDataOffer() {
  const [busy, setBusy] = useState(false);
  return (
    <div className={styles.hint} data-testid="welcome-testdata-offer">
      <p className={styles.text}>{tDev.offer.hint}</p>
      <Button
        disabled={busy}
        data-testid="welcome-testdata"
        onClick={async () => {
          setBusy(true);
          try {
            await (await loadSeed?.())?.autoFillIfEmpty(undefined, { asked: true });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? tDev.offer.busy : tDev.offer.button}
      </Button>
    </div>
  );
}
