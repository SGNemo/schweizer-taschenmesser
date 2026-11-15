import { useEffect, useState } from 'react';
import { getPlatform } from '@/core/platform';
import type { DriveInfo } from '@/core/platform/disk';
import type { CareHealth } from '@/core/platform/optimize';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Card } from '@/ui';
import { adviceFor, type Advice as AdviceItem } from '../logic/advice';
import { formatCapacity } from '../logic/drives';
import styles from './Advice.module.css';

/**
 * "Empfehlungen" above the drives: at most three calm sentences, each with one next step. Shown
 * only when there is something to do; a PC that is fine gets no extra block. Read only – a
 * button leads to the tab or to Windows' own tool, nothing is changed from here.
 */
export function Advice({ drives, onTidy }: { drives: DriveInfo[]; onTidy: () => void }) {
  const optimize = getPlatform().disk.optimize;
  const toast = useUiStore((s) => s.toast);
  const [health, setHealth] = useState<CareHealth | null>(null);

  useEffect(() => {
    let alive = true;
    if (!optimize.windows) return;
    optimize
      .health()
      .then((h) => alive && setHealth(h))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [optimize]);

  const items = adviceFor(drives, health);
  if (items.length === 0) return null;
  const a = t.disk.advice;

  const text = (item: AdviceItem): string => {
    if (item.kind === 'full') return a.full(item.root ?? '', formatCapacity(item.freeBytes ?? 0));
    if (item.kind === 'health') return a.health(item.root ?? '');
    return a.trimOff;
  };

  const action = (item: AdviceItem) => {
    if (item.kind === 'full') return <Button onClick={onTidy}>{a.toTidy}</Button>;
    if (item.kind === 'trimOff')
      return (
        <Button
          onClick={() =>
            optimize.openTool('optimizeDrives').catch(() => toast(t.disk.tidy.windows.openFailed))
          }
        >
          {a.toOptimize}
        </Button>
      );
    // A drive that reports problems: the next step is the user's own backup, not a button here.
    return null;
  };

  return (
    <section className={styles.advice} aria-label={a.title}>
      <h2 className={styles.title}>{a.title}</h2>
      <Card as="div">
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={`${item.kind}:${item.root ?? ''}`} className={styles.row}>
              <span className={styles.text}>{text(item)}</span>
              {action(item)}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
