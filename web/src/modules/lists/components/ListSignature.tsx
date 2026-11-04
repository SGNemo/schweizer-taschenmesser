import { HeroFigure, HeroSlot } from '@/ui/identity';
import { t } from '@/strings';
import styles from './ListSignature.module.css';

/**
 * Head of the shopping list (`kennzahl`): the open count as the figure with one context line (sum, store sections), and
 * a narrow receipt slip with a jagged lower edge that lists the next entries. The slip is decoration (`aria-hidden`,
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
      <HeroSlot>
        {lines.length === 0 ? null : (
          <div className={styles.receipt} data-testid="receipt-signature" aria-hidden="true">
            {lines.slice(0, 3).map((l, i) => (
              <span key={i} className={styles.slipLine}>
                <span className={styles.slipName}>{l.name}</span>
                {l.price ? <span className={styles.slipPrice}>{l.price}</span> : null}
              </span>
            ))}
          </div>
        )}
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
    <HeroSlot>
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
