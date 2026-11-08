import { t } from '@/strings';
import { Dialog } from '@/ui';
import { CATALOG, GROUPS, catalogName } from '../catalog';
import styles from '../fitness.module.css';
import { ExercisePicto } from './ExercisePicto';

/**
 * The catalogue by group, each exercise with its pictogram (package 4). A tap adds it to the session
 * being edited; own exercises are still typed freely in the form.
 */
export function CatalogPicker({
  open,
  onPick,
  onClose,
}: {
  open: boolean;
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  const c = t.fitness.catalog;
  return (
    <Dialog open={open} onClose={onClose} title={c.title}>
      <p className={styles.hint}>{c.intro}</p>
      {GROUPS.map((g) => (
        <section key={g} aria-labelledby={`fitness-group-${g}`} className={styles.catalogGroup}>
          <h3 id={`fitness-group-${g}`} className={styles.groupLabel}>
            {c.groups[g]}
          </h3>
          <ul className={styles.catalogList}>
            {CATALOG.filter((e) => e.group === g).map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={styles.catalogItem}
                  aria-label={c.add(catalogName(e.id))}
                  onClick={() => onPick(catalogName(e.id))}
                  {...(e.id === CATALOG[0].id ? { 'data-autofocus': true } : {})}
                >
                  <ExercisePicto pattern={e.pattern} />
                  <span>{catalogName(e.id)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Dialog>
  );
}
