import type { DiskNode } from '@/core/platform/disk';
import { t } from '@/strings';
import { Button } from '@/ui';
import { formatBytes, formatCount, percent } from '../format';
import { kindShares } from '../logic/tree';
import { formatDate } from './NodeList';
import { Swatch } from './Legend';
import styles from './Details.module.css';

interface Props {
  node: DiskNode;
  /** The folder currently shown (denominator of the share). */
  current: DiskNode;
  path: string;
  /** Biggest entries of the current folder, offered while the folder itself is shown. */
  biggest: readonly DiskNode[];
  onOpen: (node: DiskNode) => void;
  onSelect: (node: DiskNode) => void;
}

export function Details({ node, current, path, biggest, onOpen, onSelect }: Props) {
  const isDir = node.kind === 'dir';
  const kinds = kindShares(node);
  const showBiggest = node.id === current.id && biggest.length > 0;
  return (
    <section className={styles.details} aria-label={t.disk.details.title} data-testid="details">
      <h2 className={styles.title} aria-live="polite">
        {node.kind === 'small' ? t.disk.scan.smallFiles(node.files) : node.name || path}
      </h2>
      <p className={styles.type}>
        {node.kind === 'dir'
          ? t.disk.details.folder
          : node.kind === 'file'
            ? t.disk.details.file
            : t.disk.details.aggregate}
      </p>
      {node.kind !== 'small' ? (
        <>
          <h3 className={styles.label}>{t.disk.details.path}</h3>
          <p className={styles.path} data-testid="details-path">
            {path}
          </p>
        </>
      ) : null}
      <dl className={styles.grid}>
        <dt>{t.disk.details.used}</dt>
        <dd data-testid="details-size">{formatBytes(node.bytes)}</dd>
        <dt>{t.disk.details.fileSize}</dt>
        <dd>{formatBytes(node.logicalBytes)}</dd>
        <dt>{t.disk.details.shareOfFolder(current.id === 0 ? '' : current.name)}</dt>
        <dd>{t.disk.details.percent(percent(node.bytes, current.bytes))}</dd>
        <dt>{t.disk.details.files}</dt>
        <dd>{formatCount(node.files)}</dd>
        <dt>{isDir ? t.disk.details.modifiedFolder : t.disk.details.modified}</dt>
        <dd>{formatDate(node.modified)}</dd>
      </dl>
      {kinds.length > 0 && node.kind !== 'file' ? (
        <>
          <h3 className={styles.label}>{t.disk.details.types}</h3>
          <ul className={styles.types}>
            {kinds.map((k) => (
              <li key={k.kind}>
                <Swatch kind={k.kind} />
                <span className={styles.typeName}>{t.disk.map.kind[k.kind]}</span>
                <span>{formatBytes(k.bytes)}</span>
                <span className={styles.muted}>{Math.round(k.fraction * 100)} %</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {node.kind !== 'small' && node.id !== current.id ? (
        <div className={styles.actions}>
          <Button onClick={() => onOpen(node)}>
            {isDir ? t.disk.details.open : t.disk.nav.open}
          </Button>
        </div>
      ) : null}
      {showBiggest ? (
        <>
          <h3 className={styles.label}>{t.disk.details.biggest}</h3>
          <ul className={styles.biggest}>
            {biggest.slice(0, 8).map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => onSelect(n)}>
                  <span className={styles.bname}>
                    {n.kind === 'small' ? t.disk.scan.smallFiles(n.files) : n.name}
                  </span>
                  <span className={styles.muted}>{formatBytes(n.bytes)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
