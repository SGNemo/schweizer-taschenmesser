import { useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { DiskNode, DupGroup } from '@/core/platform/disk';
import { t } from '@/strings';
import { Button, Checkbox } from '@/ui';
import { formatBytes } from '../format';
import { joinPath } from '../logic/tree';
import { useDiskStore } from '../store';
import styles from './Duplicates.module.css';

type State = 'idle' | 'searching' | 'done' | 'failed';

/**
 * Finds identical files below the current folder. The user decides what goes into the basket:
 * at least one file of every group has to stay, and nothing is deleted from here.
 */
export function Duplicates({
  scanId,
  under,
  root,
}: {
  scanId: number;
  under: number;
  root: string;
}) {
  const disk = getPlatform().disk;
  const [state, setState] = useState<State>('idle');
  const [groups, setGroups] = useState<DupGroup[]>([]);
  const basket = useDiskStore((s) => s.basket);
  const add = useDiskStore((s) => s.addToBasket);
  const remove = useDiskStore((s) => s.removeFromBasket);

  const search = async () => {
    setState('searching');
    try {
      setGroups(await disk.findDuplicates(scanId, under));
      setState('done');
    } catch {
      setState('failed');
    }
  };

  const inBasket = (n: DiskNode) => basket.some((b) => b.id === n.id);
  const toggle = (g: DupGroup, n: DiskNode) => {
    if (inBasket(n)) return remove(n.id);
    // Keep one: refuse to take the last remaining copy of a group.
    if (g.files.filter((f) => !inBasket(f)).length <= 1) return;
    add({ id: n.id, name: n.name, bytes: n.bytes, files: n.files, isDir: false });
  };

  return (
    <div className={styles.root} data-testid="duplicates">
      <p className={styles.hint}>{t.disk.dupes.hint}</p>
      <div className={styles.actions}>
        {state === 'searching' ? (
          <>
            <span aria-live="polite">{t.disk.dupes.searching}</span>
            <Button onClick={() => void disk.cancelDuplicates(scanId)}>{t.disk.dupes.stop}</Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => void search()}>
            {t.disk.dupes.search}
          </Button>
        )}
      </div>
      {state === 'failed' ? <p role="alert">{t.disk.dupes.failed}</p> : null}
      {state === 'done' && groups.length === 0 ? <p role="status">{t.disk.dupes.none}</p> : null}
      {groups.map((g, gi) => (
        <section key={`${g.size}-${gi}`} className={styles.group} aria-label={t.disk.dupes.title}>
          <h3 className={styles.title}>
            {t.disk.dupes.group(g.files.length, formatBytes(g.size), formatBytes(g.wasted))}
          </h3>
          <ul className={styles.files}>
            {g.files.map((n) => (
              <li key={n.id}>
                <Checkbox
                  label={
                    <span className={styles.file}>
                      <strong>{n.name}</strong>
                      <span className={styles.path}>
                        {joinPath(root, ...(n.relPath ?? '').split(/[\\/]/))}
                      </span>
                    </span>
                  }
                  aria-label={t.disk.dupes.select(n.name)}
                  checked={inBasket(n)}
                  disabled={!inBasket(n) && g.files.filter((f) => !inBasket(f)).length <= 1}
                  onChange={() => toggle(g, n)}
                />
              </li>
            ))}
          </ul>
          <p className={styles.hint}>{t.disk.dupes.keepOne}</p>
        </section>
      ))}
    </div>
  );
}
