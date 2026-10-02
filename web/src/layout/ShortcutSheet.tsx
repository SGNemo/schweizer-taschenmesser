import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Dialog } from '@/ui';
import styles from './ShortcutSheet.module.css';

/** `?` – the list of keyboard shortcuts. */
export function ShortcutSheet() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t.shortcuts.title}>
      <p className={styles.hint}>{t.shortcuts.hint}</p>
      <dl className={styles.list}>
        {t.shortcuts.items.map((item) => (
          <div key={item.text} className={styles.row}>
            <dt className={styles.keys}>
              {item.keys.map((k) => (
                <kbd key={k} className={styles.kbd}>
                  {k}
                </kbd>
              ))}
            </dt>
            <dd className={styles.text}>{item.text}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
