import { useState } from 'react';
import { downloadTextFile } from '@/core/backup/download';
import { pickTextFile } from '@/core/io/pickFile';
import { describeChange } from '@/core/settings/history';
import {
  applyImport,
  buildExport,
  parseTransfer,
  planImport,
  type ChangeLine,
} from '@/core/settings/transfer';
import { useUiStore } from '@/stores/ui';
import { tSettings3 } from '@/strings.settings3';
import { Button, SettingRow, SettingsGroup } from '@/ui';
import settingsStyles from './settings.module.css';

const SHOWN = 8;

/** Settings → Allgemein → Verwalten → "Einstellungen sichern": a file out, a file in with a preview first. */
export function TransferSection() {
  const x = tSettings3.use().transfer;
  const toast = useUiStore((s) => s.toast);
  const [lines, setLines] = useState<ChangeLine[]>();
  const [error, setError] = useState<string>();

  const doExport = async () => {
    const file = await buildExport();
    const result = await downloadTextFile(x.fileName, JSON.stringify(file, null, 2));
    if (result === 'saved') toast(x.exported);
  };

  const doPick = async () => {
    setError(undefined);
    setLines(undefined);
    const picked = await pickTextFile('.json,application/json');
    if (!picked) return;
    const parsed = parseTransfer(picked.text);
    if (!parsed.ok) {
      setError(parsed.error === 'version' ? x.errorVersion : x.errorFormat);
      return;
    }
    setLines(await planImport(parsed.file));
  };

  return (
    <SettingsGroup id="settings-transfer" title={x.title} description={x.description}>
      <SettingRow id="settings-transfer--export" label={x.export} description={x.excluded}>
        <Button onClick={() => void doExport()} data-testid="settings-export">
          {x.export}
        </Button>
      </SettingRow>
      <SettingRow id="settings-transfer--import" label={x.import} stacked>
        <div className={settingsStyles.form}>
          <div>
            <Button onClick={() => void doPick()} data-testid="settings-import">
              {x.import}
            </Button>
          </div>
          {error ? (
            <p role="alert" className={settingsStyles.error}>
              {error}
            </p>
          ) : null}
          {lines ? (
            <div role="status" data-testid="import-preview">
              <p>{lines.length === 0 ? x.noChange : x.previewTitle(lines.length)}</p>
              {lines.length > 0 ? (
                <ul className={settingsStyles.muted}>
                  {lines.slice(0, SHOWN).map((l) => (
                    <li key={`${l.scope}.${l.key}`}>
                      {describeChange(l.scope, l.key, l.before, l.after)}
                    </li>
                  ))}
                </ul>
              ) : null}
              <span className={settingsStyles.row}>
                {lines.length > 0 ? (
                  <Button
                    variant="primary"
                    onClick={() => void applyImport(lines).then(() => setLines(undefined))}
                    data-testid="import-apply"
                  >
                    {x.apply}
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={() => setLines(undefined)}>
                  {x.cancel}
                </Button>
              </span>
            </div>
          ) : null}
        </div>
      </SettingRow>
    </SettingsGroup>
  );
}
