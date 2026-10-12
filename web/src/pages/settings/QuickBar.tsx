import { applyQuick, QUICK_SETTINGS, type QuickSetting } from '@/core/settings/quick';
import { tComfort } from '@/strings.comfort';
import { useUiStore } from '@/stores/ui';
import { Segmented } from '@/ui';
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

/** One row of switches at the top of Settings: theme, density, reading aid without opening a category. */
export function QuickBar() {
  return (
    <section
      className={styles.quick}
      aria-label={tComfort.get().quick.title}
      data-testid="quick-bar"
    >
      {QUICK_SETTINGS.filter((q) => IN_BAR.includes(q.id)).map((q) => (
        <QuickSwitch key={q.id} setting={q} />
      ))}
    </section>
  );
}
