import type { ReactNode } from 'react';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { t } from '@/strings';
import styles from './ListSignature.module.css';

/**
 * Head figure of a shopping list (Identity 4.0): the open count with one context line (the store sections). The
 * sums stand in the page's first line; nothing is said twice.
 */
export function ListFigure({
  name,
  open,
  detail,
}: {
  name: string;
  open: number;
  detail?: string;
}) {
  return (
    <HeroSlot area="figure">
      <HeroFigure
        label={name}
        value={String(open)}
        unit={t.lists.figureUnit}
        detail={detail}
        testId="lists-open"
      />
    </HeroSlot>
  );
}

/**
 * The first line of a list's page: the sums of a shopping list, or what is packed and when the trip starts. It
 * took over the text that stood beside the suitcase and the receipt in the head before Identity 4.0.
 */
export function ListSummary({
  testId,
  note,
  children,
}: {
  testId?: string;
  /** A quiet addition at the end of the line ("Nur Artikel mit Preis"). */
  note?: string;
  children: ReactNode;
}) {
  return (
    <p className={styles.summary} data-testid={testId}>
      {children}
      {note ? <span className={styles.note}> ({note})</span> : null}
    </p>
  );
}
