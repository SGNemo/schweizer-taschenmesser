import { StatusLineLink } from '@/core/status/StatusLineLink';
import { tSettingsV3 } from '@/strings.settingsV3';
import { STATUS_LOOK } from './categoryLook';
import { PageHead } from './PageHead';
import { useSettingsStatus } from './useSettingsStatus';
import styles from './StatusHead.module.css';

/**
 * Head of `/settings` (variant "Status"): the six states that matter most as lines, each a jump
 * into its category. Every tile says what the state means in one line; the accent marks "needs a look".
 */
export function StatusHead({ title }: { title: string }) {
  const v3 = tSettingsV3.use();
  const tiles = useSettingsStatus();
  return (
    <PageHead
      {...STATUS_LOOK}
      icon="settings"
      eyebrow={v3.statusEyebrow}
      title={title}
      size="tall"
      testId="settings-head"
    >
      <section aria-label={v3.statusLabel}>
        {/* Empty until the states are known: the lines come together, never six that turn into three. */}
        <ul className={styles.tiles} data-testid="settings-status" aria-busy={!tiles}>
          {(tiles ?? []).map((tile) => (
            <li key={tile.id}>
              <StatusLineLink line={tile} hideGenericOnPhone />
            </li>
          ))}
        </ul>
      </section>
    </PageHead>
  );
}
