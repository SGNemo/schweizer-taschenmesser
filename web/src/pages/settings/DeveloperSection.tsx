import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import {
  applySeed,
  DEMO_PASSPHRASE,
  isSeedSyncOn,
  readSeedState,
  removeSeed,
  resetEverything,
  seedCounts,
  setSeedSync,
} from '@/core/seed/dev';
import { SEED_SCALES, type SeedScale } from '@/core/seed/types';
import { availableManifests } from '@/core/modules/available';
import { tDev } from '@/strings.dev';
import { useUiStore } from '@/stores/ui';
import { Button, Card, DangerZone, SelectField, Switch, TextField } from '@/ui';
import styles from './settings.module.css';

/** Dev-Preview only: generated test data (see `core/seed/`). Stable builds never mount this. */
export default function DeveloperSection() {
  const toast = useUiStore((s) => s.toast);
  const state = useLiveQuery(() => readSeedState(), []);
  const counts = useLiveQuery(() => seedCounts(), []);
  const syncOn = useLiveQuery(() => isSeedSyncOn(), []);
  const [scale, setScale] = useState<SeedScale>('medium');
  const [busy, setBusy] = useState<string | undefined>();
  const [progress, setProgress] = useState('');
  const [confirm, setConfirm] = useState('');
  const total = Object.values(counts ?? {}).reduce((a, b) => a + b, 0);

  async function run(label: string, action: () => Promise<string>) {
    setBusy(label);
    try {
      toast(await action());
    } catch {
      toast(tDev.load.error);
    } finally {
      setBusy(undefined);
      setProgress('');
    }
  }

  return (
    <Card>
      <div className={styles.form}>
        <p className={styles.muted}>{tDev.intro}</p>
        <SelectField
          label={tDev.load.scale}
          value={scale}
          onChange={(e) => setScale(e.target.value as SeedScale)}
        >
          {SEED_SCALES.map((s) => (
            <option key={s} value={s}>
              {tDev.load[s]}
            </option>
          ))}
        </SelectField>
        <div className={styles.row}>
          <Button
            variant="primary"
            disabled={busy !== undefined}
            data-testid="seed-load"
            onClick={() =>
              void run('load', async () => {
                let shown = 0;
                await applySeed({
                  scale,
                  onProgress: (done, all) => {
                    if (done - shown >= 500 || done === all) {
                      shown = done;
                      setProgress(tDev.load.busy(done, all));
                    }
                  },
                });
                return tDev.load.done(Object.values(await seedCounts()).reduce((a, b) => a + b, 0));
              })
            }
          >
            {busy === 'load' && progress ? progress : tDev.load.button}
          </Button>
          <Button
            disabled={busy !== undefined || total === 0}
            data-testid="seed-remove"
            onClick={() =>
              void run('remove', async () => tDev.remove.done((await removeSeed()).removed))
            }
          >
            {tDev.remove.button}
          </Button>
        </div>
        <p className={styles.muted}>{tDev.remove.hint}</p>

        <Switch
          label={tDev.sync.label}
          hint={tDev.sync.hint}
          checked={syncOn === true}
          onChange={(on) => void setSeedSync(on)}
        />

        <h3>{tDev.status.title}</h3>
        {state ? (
          <dl className={styles.status} data-testid="seed-status">
            <dt>{tDev.status.version}</dt>
            <dd>{state.version}</dd>
            <dt>{tDev.status.reference}</dt>
            <dd>{state.today}</dd>
            <dt>{tDev.status.scale}</dt>
            <dd>{tDev.load[state.scale]}</dd>
            <dt>{tDev.status.entries}</dt>
            <dd>
              {total}
              {counts
                ? ` (${availableManifests()
                    .filter((m) => counts[m.id])
                    .map((m) => `${m.name} ${counts[m.id]}`)
                    .join(', ')})`
                : ''}
            </dd>
          </dl>
        ) : (
          <p className={styles.muted}>{tDev.status.none}</p>
        )}
        <p className={styles.muted}>{tDev.status.demoVault(DEMO_PASSPHRASE)}</p>

        <DangerZone>
          <h3>{tDev.reset.title}</h3>
          <p className={styles.muted}>{tDev.reset.hint}</p>
          <TextField
            label={tDev.reset.field}
            value={confirm}
            autoComplete="off"
            onChange={(e) => setConfirm(e.target.value)}
          />
          <div className={styles.row}>
            <Button
              variant="danger"
              disabled={confirm !== tDev.reset.phrase}
              onClick={() => void resetEverything()}
            >
              {tDev.reset.button}
            </Button>
          </div>
        </DangerZone>
      </div>
    </Card>
  );
}
