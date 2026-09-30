import { useState } from 'react';
import { BackupSection } from '@/pages/settings/BackupSection';
import { SyncSection } from '@/pages/settings/SyncSection';
import { useSyncStatus } from '@/core/sync/status';
import type { SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import { patternStyles } from '@/ui';

const s = t.setup.steps.sync;
type Choice = 'local' | 'backup' | 'connect';

/**
 * Reuses the settings sections: restoring a backup and connecting to a server are explicit actions
 * with their own confirmation there, so nothing is written by "Weiter" itself.
 */
export default function SyncStep(_props: SetupStepProps) {
  const [choice, setChoice] = useState<Choice>('local');
  const status = useSyncStatus();
  const connected = status.phase !== 'off';
  return (
    <>
      {connected ? <p role="status">{s.connected}</p> : null}
      <fieldset className={patternStyles.fieldset}>
        {(
          [
            ['local', s.local],
            ['backup', s.backup],
            ['connect', s.connect],
          ] as const
        ).map(([id, label]) => (
          <label
            key={id}
            style={{ display: 'flex', gap: 'var(--space-2)', minHeight: 44, alignItems: 'center' }}
          >
            <input
              type="radio"
              name="setup-sync"
              checked={choice === id}
              onChange={() => setChoice(id)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {choice === 'local' ? <p className={patternStyles.muted}>{s.localHint}</p> : null}
      {choice === 'backup' ? <BackupSection /> : null}
      {choice === 'connect' ? (
        <>
          <SyncSection />
          <p className={patternStyles.muted}>{s.afterConnect}</p>
        </>
      ) : null}
    </>
  );
}
