import { t } from '@/strings';
import { Icon, IconButton } from '@/ui';
import styles from './TabBar.module.css';

export interface TabEntry {
  id: string;
  title: string;
  active: boolean;
}

/** Open pages as tabs (wide screens). The phone lists them above the page list instead. */
export function TabBar({
  tabs,
  onSelect,
  onClose,
}: {
  tabs: TabEntry[];
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  if (tabs.length < 2) return null;
  return (
    <nav className={styles.bar} aria-label={t.notes.tabsLabel}>
      {tabs.map((tab) => (
        <span key={tab.id} className={tab.active ? `${styles.tab} ${styles.active}` : styles.tab}>
          <button
            type="button"
            className={styles.label}
            aria-current={tab.active ? 'page' : undefined}
            onClick={() => onSelect(tab.id)}
          >
            {tab.title}
          </button>
          <IconButton label={t.notes.closeTab(tab.title)} onClick={() => onClose(tab.id)}>
            <Icon name="close" size={16} />
          </IconButton>
        </span>
      ))}
    </nav>
  );
}
