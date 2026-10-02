import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import { buildCommit, versionLabel } from '@/core/about/info';
import { isDevBuild } from '@/core/update/buildInfo';
import { checkForUpdate, useUpdateStore } from '@/core/update/controller';
import { loadPrefs, savePrefs, type UpdatePrefs } from '@/core/update/prefs';
import { t } from '@/strings';
import { Button, Card, HelpHint, SelectField, Switch } from '@/ui';
import styles from './settings.module.css';

/** Version, channel and automatic checks of the installed app (browser: only a hint). */
export function UpdateSection() {
  const platform = getPlatform();
  const state = useUpdateStore((s) => s.state);
  const [prefs, setPrefs] = useState<UpdatePrefs | undefined>();
  const [version, setVersion] = useState('');

  useEffect(() => {
    let alive = true;
    void Promise.all([loadPrefs(), platform.app.version()]).then(([p, v]) => {
      if (!alive) return;
      setPrefs(p);
      setVersion(v);
    });
    return () => {
      alive = false;
    };
  }, [platform]);

  const update = async (patch: Partial<UpdatePrefs>) => setPrefs(await savePrefs(patch));

  return (
    <Card>
      <div className={styles.form}>
        <p>{t.update.settings.intro}</p>
        <p data-testid="app-version">
          {t.update.settings.version}:{' '}
          <strong>
            {versionLabel({
              version,
              channel: isDevBuild() ? 'dev' : 'stable',
              commit: buildCommit(),
            })}
          </strong>
        </p>
        {!platform.updater.supported ? (
          <p className={styles.muted}>{t.update.settings.browserHint}</p>
        ) : prefs ? (
          <>
            {isDevBuild() ? (
              <p data-testid="update-channel-dev">
                {t.update.settings.channel}: <strong>{t.update.settings.channelDev}</strong>{' '}
                <HelpHint text={t.update.settings.devHelp} />
              </p>
            ) : (
              <SelectField
                label={t.update.settings.channel}
                value={prefs.channel}
                onChange={(e) => void update({ channel: e.target.value as UpdatePrefs['channel'] })}
              >
                <option value="stable">{t.update.settings.channelStable}</option>
                <option value="beta">{t.update.settings.channelBeta}</option>
              </SelectField>
            )}
            <Switch
              label={t.update.settings.auto}
              hint={t.update.settings.autoHint}
              checked={prefs.auto}
              onChange={(auto) => void update({ auto })}
            />
            <div className={styles.row}>
              <Button
                onClick={() => void checkForUpdate({ manual: true })}
                disabled={state.phase === 'checking' || state.phase === 'installing'}
              >
                {t.update.settings.checkNow}
              </Button>
              <span role="status" className={styles.muted}>
                {state.phase === 'checking'
                  ? t.update.settings.checking
                  : state.phase === 'up-to-date'
                    ? t.update.settings.upToDate
                    : state.phase === 'available'
                      ? t.update.available(state.info.version)
                      : ''}
              </span>
            </div>
            {state.phase === 'error' && !state.info ? (
              <p role="alert" className={styles.error}>
                {t.update.errors[state.code]}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}
