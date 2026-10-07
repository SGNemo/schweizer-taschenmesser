import { Link } from 'react-router';
import { rankAttention, useAttentionItems } from '@/core/modules/contributions';
import { useLiveAttention } from '@/core/modules/liveAttention';
import type { AttentionItem } from '@/core/modules/types';
import { useFocusSettings } from '@/core/settings/focus';
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
function Chips({ items }: { items: AttentionItem[] }) {
  return (
    <ul className={styles.list}>
      {items.map((i) => (
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
  );
}

/** Items that need an action today stay visible; everything else is "Wartet noch", folded away. */
const isToday = (i: AttentionItem): boolean => i.tone === 'accent' || i.id.startsWith('core:');

export function AttentionStrip() {
  const items = useAttentionItems();
  const core = useCoreItems();
  const live = useLiveAttention((s) => s.bySource);
  const [focus] = useFocusSettings();
  const all = [...core, ...rankAttention([...(items ?? []), ...Object.values(live).flat()])];
  if (all.length === 0) return null;

  if (!focus.calmAttention)
    return (
      <section className={styles.strip} aria-label={t.attention.title}>
        <h2 className={styles.heading}>{t.attention.title}</h2>
        <Chips items={all} />
      </section>
    );

  const visible = all.filter(isToday);
  const waiting = all.filter((i) => !isToday(i));
  return (
    <section className={styles.strip} aria-label={t.attention.title}>
      {visible.length > 0 ? (
        <>
          <h2 className={styles.heading}>{t.attention.title}</h2>
          <Chips items={visible} />
        </>
      ) : null}
      {waiting.length > 0 ? (
        <details className={styles.waiting} data-testid="attention-waiting">
          <summary className={styles.summary}>
            <span className={styles.chevron}>
              <Icon name="chevronRight" size={16} />
            </span>
            <span className={styles.summaryTitle}>{t.attention.waiting(waiting.length)}</span>
            <span className={styles.summaryHint}>
              {waiting
                .slice(0, 2)
                .map((i) => i.title)
                .join(' · ')}
            </span>
          </summary>
          <Chips items={waiting} />
          <p className={styles.reassure}>{t.attention.nothingNow}</p>
        </details>
      ) : null}
    </section>
  );
}
