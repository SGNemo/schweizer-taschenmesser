import { Link, useLocation } from 'react-router';
import { useFocusSettings } from '@/core/settings/focus';
import { t } from '@/strings';
import { Icon } from '@/ui';
import { rankAttention, useAttentionItems } from './contributions';
import styles from './NowStrip.module.css';

/** A page shows at most this many items; the rest stays on the overview. */
const MAX_ITEMS = 2;

/**
 * A slim "Jetzt" row at the top of a module page: the same items as "Jetzt wichtig" on the
 * overview, limited to the given modules. Renders nothing when nothing is up, or when the user
 * switched it off (Einstellungen → Fokus & Aufmerksamkeit). An item that points at the page the
 * user is already on is plain text, not a link.
 */
export function NowStrip({ modules }: { modules: readonly string[] }) {
  const [focus] = useFocusSettings();
  const items = useAttentionItems();
  const { pathname } = useLocation();
  if (!focus.moduleNow || !items) return null;
  const mine = rankAttention(
    items.filter((i) => modules.some((m) => i.id.startsWith(`${m}:`))),
    MAX_ITEMS,
  );
  if (mine.length === 0) return null;
  return (
    <ul className={styles.strip} aria-label={t.attention.title} data-testid="now-strip">
      {mine.map((i) => {
        const body = (
          <>
            <Icon name={i.icon} size={18} />
            <span className={styles.text}>
              <span className={styles.title}>{i.title}</span>
              {i.detail ? <span className={styles.detail}>{i.detail}</span> : null}
            </span>
          </>
        );
        return (
          <li key={i.id}>
            {i.to === pathname ? (
              <div className={styles.item} data-tone={i.tone}>
                {body}
              </div>
            ) : (
              <Link to={i.to} className={styles.item} data-tone={i.tone}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
