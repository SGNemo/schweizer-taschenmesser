import { HeroFigure, HeroSlot, Receipt } from '@/ui/identity';
import { t } from '@/strings';
import styles from './ListSignature.module.css';

/**
 * Head of the shopping list (`kennzahl`): the open count as the figure with one context line (sum, store sections), and
 * the receipt from the signature library in slot M with the next entry on it. The slip is decoration (`aria-hidden`,
 * the list below says the same in text) and never moves.
 */
export function ReceiptSignature({
  name,
  open,
  detail,
  lines,
}: {
  name: string;
  open: number;
  detail?: string;
  lines: { name: string; price?: string }[];
}) {
  return (
    <>
      <HeroSlot area="figure">
        <HeroFigure
          label={name}
          value={String(open)}
          unit={t.lists.figureUnit}
          detail={detail}
          testId="lists-open"
        />
      </HeroSlot>
      <HeroSlot area="signature">
        <span data-testid="receipt-signature">
          <Receipt size="M">{lines[0]?.name}</Receipt>
        </span>
      </HeroSlot>
    </>
  );
}

/**
 * Signature "suitcase" for a packing list: a case whose fill level shows how much is packed. Packed count and the
 * trip line are real text next to it; the case is `aria-hidden` and the fill changes without animation.
 */
export function SuitcaseSignature({
  done,
  total,
  line,
}: {
  done: number;
  total: number;
  line?: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <HeroSlot area="signature">
      <div className={styles.case} data-testid="suitcase-signature">
        <span className={styles.body} aria-hidden="true">
          <span className={styles.handle} />
          <span className={styles.fill} style={{ height: `${pct}%` }} />
        </span>
        <span className={styles.text}>
          <span className={styles.line}>{t.lists.progressPacked(done, total)}</span>
          {line ? <span className={styles.sub}>{line}</span> : null}
        </span>
      </div>
    </HeroSlot>
  );
}
