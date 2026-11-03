import { HeroSlot } from '@/ui/identity';
import { t } from '@/strings';
import { CATEGORIES, type DocCategory } from '../schema';
import styles from './FolderTabs.module.css';

/**
 * Signature "folder tabs": a row of tabs sticking out of a folder, one per category that holds documents, each with
 * its count. Decoration only (`aria-hidden`, nothing moves); the real filter is the category chips below.
 * It shows no titles, files or dates: counts only.
 */
export function FolderTabs({ counts }: { counts: Partial<Record<DocCategory, number>> }) {
  const used = CATEGORIES.filter((c) => (counts[c] ?? 0) > 0);
  if (used.length === 0) return null;
  return (
    <HeroSlot>
      <div className={styles.folder} aria-hidden="true" data-testid="folder-tabs">
        <div className={styles.tabs}>
          {used.map((c, i) => (
            <span key={c} className={styles.tab} data-first={i === 0 ? 'true' : undefined}>
              <span>{t.vault.categories[c]}</span>
              <span className={styles.num}>{counts[c]}</span>
            </span>
          ))}
        </div>
        <div className={styles.body} />
      </div>
    </HeroSlot>
  );
}
