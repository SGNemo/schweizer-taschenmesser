import { applyQuick, QUICK_SETTINGS, type QuickSetting } from '@/core/settings/quick';
import { tComfort } from '@/strings.comfort';
import { useUiStore } from '@/stores/ui';
import { applyProfile, builtinProfiles, useCustomProfiles } from '@/core/settings/profiles';
import { tSettings3 } from '@/strings.settings3';
import { Segmented, SelectField } from '@/ui';
import { useActiveProfileId } from './useActiveProfile';
import { MuteSwitch } from './MuteSwitch';
import styles from './SettingsLayout.module.css';

/** The three switches people reach for most; the rest is still one command away in the palette. */
const IN_BAR: readonly QuickSetting['id'][] = ['theme', 'density', 'readAid'];

function QuickSwitch({ setting }: { setting: QuickSetting }) {
  // The store notifies on every change; the selector reads the one value this switch shows.
  const value = useUiStore(() => setting.read());
  return (
    <div className={styles.quickItem}>
      <span className={styles.quickLabel}>{setting.label()}</span>
      <Segmented<string>
        label={setting.label()}
        value={value}
        options={setting.options()}
        onChange={(v) => applyQuick(setting, v)}
      />
    </div>
  );
}

/** One quick switch inside a search hit: the setting can be changed without opening its page. */
export function QuickInline({ id }: { id: QuickSetting['id'] }) {
  const setting = QUICK_SETTINGS.find((q) => q.id === id);
  const value = useUiStore(() => setting?.read() ?? '');
  if (!setting) return null;
  return (
    <div className={styles.resultQuick} data-testid={`search-quick-${id}`}>
      <Segmented<string>
        label={setting.label()}
        value={value}
        options={setting.options()}
        onChange={(v) => applyQuick(setting, v)}
      />
    </div>
  );
}

/** The profile switch: many settings in one choice (the list shows "Eigene Auswahl" while no profile matches). */
function ProfileSwitch() {
  const p = tSettings3.use().profiles;
  const all = [...builtinProfiles(), ...useCustomProfiles()];
  const active = useActiveProfileId(all);
  return (
    <div className={styles.quickItem}>
      <span className={styles.quickLabel}>{p.switchLabel}</span>
      <SelectField
        label={p.switchLabel}
        labelHidden
        value={active ?? ''}
        onChange={(e) => {
          const next = all.find((x) => x.id === e.target.value);
          if (next) void applyProfile(next);
        }}
        data-testid="quick-profile"
      >
        <option value="" disabled>
          {p.none}
        </option>
        {all.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

/**
 * The quick switches of the settings start page: theme, density, reading aid, profile and "Ruhe" without opening a
 * category. One named group on a raised tone (Identity 4.0); it is on `/settings` only, each switch has its own row
 * in a tab and a command in the palette.
 */
export function QuickBar() {
  const title = tComfort.use().quick.title;
  return (
    <section
      className={styles.quick}
      aria-labelledby="settings-quick-title"
      data-testid="quick-bar"
    >
      <h2 id="settings-quick-title" className={styles.quickTitle}>
        {title}
      </h2>
      <div className={styles.quickItems}>
        {QUICK_SETTINGS.filter((q) => IN_BAR.includes(q.id)).map((q) => (
          <QuickSwitch key={q.id} setting={q} />
        ))}
        <ProfileSwitch />
        <MuteSwitch />
      </div>
    </section>
  );
}
