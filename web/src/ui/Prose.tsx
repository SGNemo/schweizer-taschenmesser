import type { ReactNode } from 'react';
import styles from './Prose.module.css';

/** Running text: limited line length (`--measure`), paragraph spacing instead of blank lines, hanging indent in lists. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={[styles.prose, className ?? ''].filter(Boolean).join(' ')}>{children}</div>;
}
