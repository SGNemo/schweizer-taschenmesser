import { useEffect, useState } from 'react';
import { backupFileName, createBackup, serializeBackup } from '@/core/backup/backup';
import { downloadTextFile } from '@/core/backup/download';
import { getPlatform } from '@/core/platform';
import type { SetupStepProps } from '@/core/setup/types';
import { loadPrefs, savePrefs, type UpdatePrefs } from '@/core/update/prefs';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, SelectField, Switch } from '@/ui';

const s = t.setup.steps.backupupdates;

/** Manual backup (explicit action) and the update preferences (draft, written on "Weiter"). */
export default function BackupUpdatesStep({ registerCommit }: SetupStepProps) {
  const toast = useUiStore((st) => st.toast);
  const native = getPlatform().isNative;
  const [prefs, setPrefs] = useState<UpdatePrefs | undefined>();
  const [draft, setDraft] = useState<UpdatePrefs | undefined>();

  useEffect(() => {
    let live = true;
    void loadPrefs().then((p) => live && setPrefs(p));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    registerCommit(draft ? () => savePrefs(draft).then(() => undefined) : null);
    return () => registerCommit(null);
  }, [registerCommit, draft]);

  async function backupNow() {
    const result = await downloadTextFile(backupFileName(), serializeBackup(await createBackup()));
    if (result === 'saved') toast(t.backup.exported);
  }

  const values = draft ?? prefs;
  return (
    <>
      <div>
        <Button onClick={() => void backupNow()}>{s.backupNow}</Button>
        <p style={{ color: 'var(--text-muted)' }}>{s.autoNote}</p>
      </div>
      {!native ? <p>{s.browser}</p> : null}
      {native && values ? (
        <>
          <SelectField
            label={s.channel}
            value={values.channel}
            onChange={(e) =>
              setDraft({ ...values, channel: e.target.value as UpdatePrefs['channel'] })
            }
          >
            <option value="stable">{s.stable}</option>
            <option value="beta">{s.beta}</option>
          </SelectField>
          <Switch
            label={s.auto}
            checked={values.auto}
            onChange={(on) => setDraft({ ...values, auto: on })}
          />
        </>
      ) : null}
    </>
  );
}
