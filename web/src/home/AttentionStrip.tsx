import { Link } from 'react-router';
import { useAttentionItems } from '@/core/modules/contributions';
import type { AttentionItem } from '@/core/modules/types';
import { useUpdateStore } from '@/core/update/controller';
import { t } from '@/strings';
import { Icon } from '@/ui';
import styles from './AttentionStrip.module.css';

/** Core items that do not belong to a module. */
function useCoreItems(): AttentionItem[] {
  const update = useUpdateStore((s) => s.state);
  return update.phase === 'available'
    ? [
        {
          id: 'core:update',
          tone: 'accent',
          icon: 'download',
          title: t.attention.updateAvailable,
          detail: update.info.version,
          to: '/settings#updates',
          rank: 0,
        },
      ]
    : [];
}

/**
 * "Jetzt wichtig": what needs attention right now as a slim row of small cards with a coloured
 * edge, an icon and text. Renders nothing at all when there is nothing urgent.
 */
export function AttentionStrip() {
  const items = useAttentionItems();
  const core = useCoreItems();
  const all = [...core, ...(items ?? [])];
  if (all.length === 0) return null;
  return (
    <section className={styles.strip} aria-label={t.attention.title}>
      <h2 className={styles.heading}>{t.attention.title}</h2>
      <ul className={styles.list}>
        {all.map((i) => (
          <li key={i.id}>
            <Link to={i.to} className={styles.item} data-tone={i.tone}>
              <Icon name={i.icon} size={18} />
              <span className={styles.text}>
                <span className={styles.title}>{i.title}</span>
                {i.detail ? <span className={styles.detail}>{i.detail}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
