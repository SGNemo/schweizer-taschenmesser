import { Link } from 'react-router';
import { tSettingsV3 } from '@/strings.settingsV3';
import { Icon } from '@/ui';
import { STATUS_LOOK } from './categoryLook';
import { PageHead } from './PageHead';
import { useSettingsStatus } from './useSettingsStatus';
import styles from './StatusHead.module.css';

/**
 * Head of `/settings` (variant "Status"): the six states that matter most as figure tiles, each a jump
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
        <ul className={styles.tiles} data-testid="settings-status">
          {tiles.map((tile) => (
            <li key={tile.id}>
              <Link
                to={tile.to}
                className={styles.tile}
                data-testid={tile.testId}
                data-attention={tile.attention}
                data-generic={tile.generic || undefined}
              >
                <span className={styles.name}>
                  <Icon name={tile.icon} />
                  {tile.title}
                </span>
                <span className={styles.status}>{tile.status}</span>
                <span className={styles.context}>{tile.context}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageHead>
  );
}
