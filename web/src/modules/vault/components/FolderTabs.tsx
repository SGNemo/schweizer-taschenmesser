import { t } from '@/strings';
import { CATEGORIES, type DocCategory } from '../schema';
import styles from './FolderTabs.module.css';

/**
 * Signature "folder tabs", and the category filter at once: a row of tabs on a folder, "all" plus one per category
 * with its count. The chosen tab is filled and joins the folder below (shape and fill, not only colour); each tab
 * is a button with `aria-pressed` named after its category. Counts only, never titles, files or dates.
 */
export function FolderTabs({
  counts,
  total,
  value,
  onChange,
}: {
  counts: Partial<Record<DocCategory, number>>;
  total: number;
  value: DocCategory | 'all';
  onChange: (value: DocCategory | 'all') => void;
}) {
  const tabs: { id: DocCategory | 'all'; label: string; n: number }[] = [
    { id: 'all', label: t.vault.allCategories, n: total },
    ...CATEGORIES.map((c) => ({ id: c, label: t.vault.categories[c] ?? c, n: counts[c] ?? 0 })),
  ];
  return (
    <div
      className={styles.folder}
      role="group"
      aria-label={t.vault.category}
      data-testid="folder-tabs"
    >
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={styles.tab}
            aria-pressed={value === tab.id}
            onClick={() => onChange(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.n > 0 ? <span className={styles.num}>{tab.n}</span> : null}
          </button>
        ))}
      </div>
      <div className={styles.body} aria-hidden="true" />
    </div>
  );
}
