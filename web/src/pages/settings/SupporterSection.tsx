import { useState } from 'react';
import { enterCode, removeCode, updateSupporterPrefs, useSupporter } from '@/core/supporter';
import { useSupporterSettings } from '@/core/supporter';
import { getPlatform } from '@/core/platform';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, SettingRow, SettingsGroup, Switch, TextField } from '@/ui';
import { CONTACT_URL, RESEND_PAGE_URL, SUPPORT_PAGE_URL } from './supporterLinks';
import styles from './settings.module.css';

const s = t.supporter.section;

/**
 * Einstellungen → Über Nemo → Supporter. Nothing here is required: the code only unlocks cosmetic
 * extras, it is checked on this device and never sent anywhere.
 */
export function SupporterSection() {
  const toast = useUiStore((st) => st.toast);
  const status = useSupporter();
  const [settings] = useSupporterSettings();
  const [input, setInput] = useState('');
  const [invalid, setInvalid] = useState(false);
  const open = (url: string) => void getPlatform().app.openUrl(url);

  async function save() {
    if (!input.trim()) return;
    if (await enterCode(input)) {
      setInput('');
      setInvalid(false);
      toast(s.accepted);
    } else setInvalid(true);
  }

  async function paste() {
    try {
      setInput(await navigator.clipboard.readText());
      setInvalid(false);
    } catch {
      toast(s.pasteFailed);
    }
  }

  return (
    <SettingsGroup id="supporter" title={s.title}>
      <div className={styles.form}>
        <p>{s.intro}</p>
        {SUPPORT_PAGE_URL ? (
          <div className={styles.row}>
            <Button variant="primary" onClick={() => open(SUPPORT_PAGE_URL)}>
              {s.donate}
            </Button>
            <span className={styles.muted}>{s.donateHint}</span>
          </div>
        ) : null}
      </div>

      <SettingRow id="supporter--code" label={s.codeLabel} description={s.codeHint} stacked>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <TextField
            label={s.codeLabel}
            labelHidden
            value={input}
            placeholder={s.codePlaceholder}
            autoComplete="off"
            spellCheck={false}
            error={invalid ? s.invalid : undefined}
            data-testid="supporter-code-input"
            onChange={(e) => {
              setInput(e.target.value);
              setInvalid(false);
            }}
          />
          <div className={styles.row}>
            <Button onClick={() => void paste()}>{s.paste}</Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!input.trim()}
              data-testid="supporter-code-save"
            >
              {s.save}
            </Button>
          </div>
        </form>
      </SettingRow>

      <SettingRow id="supporter--status" label={s.statusTitle} stacked>
        {status.tier === 'none' ? (
          <div className={styles.form}>
            <p className={styles.muted} data-testid="supporter-status">
              {status.unrecognised ? s.unrecognised : s.notSupporter}
            </p>
            {status.unrecognised ? (
              <div className={styles.row}>
                <Button onClick={() => void removeCode().then(() => toast(s.removed))}>
                  {s.remove}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className={styles.form}>
            <dl className={styles.status} data-testid="supporter-status">
              <dt>{s.tierLabel}</dt>
              <dd>{t.supporter.tier[status.tier]}</dd>
              {status.name ? (
                <>
                  <dt>{s.nameLabel}</dt>
                  <dd>{status.name}</dd>
                </>
              ) : null}
              {status.issued ? (
                <>
                  <dt>{s.issuedLabel}</dt>
                  <dd>{formatDay(status.issued, 'dd.MM.yyyy')}</dd>
                </>
              ) : null}
            </dl>
            {status.source === 'code' ? (
              <div className={styles.row}>
                <Button
                  data-testid="supporter-code-remove"
                  onClick={() => void removeCode().then(() => toast(s.removed))}
                >
                  {s.remove}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </SettingRow>

      <SettingRow id="supporter--badge" label={s.sidebarBadge} description={s.sidebarBadgeHint}>
        <Switch
          label={s.sidebarBadge}
          labelHidden
          checked={status.tier !== 'none' && settings?.showSidebarBadge === true}
          disabled={status.tier === 'none'}
          onChange={(on) => void updateSupporterPrefs({ showSidebarBadge: on })}
        />
      </SettingRow>

      <SettingRow id="supporter--help" label={s.noMail}>
        <div className={styles.row}>
          {RESEND_PAGE_URL ? (
            <Button onClick={() => open(RESEND_PAGE_URL)}>{s.resend}</Button>
          ) : null}
          <Button onClick={() => open(CONTACT_URL)}>{s.contact}</Button>
        </div>
      </SettingRow>
    </SettingsGroup>
  );
}
