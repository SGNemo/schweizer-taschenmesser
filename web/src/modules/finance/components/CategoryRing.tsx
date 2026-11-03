import { formatMoney } from '@/core/money';
import { t } from '@/strings';
import { Card } from '@/ui';
import { Ring, ringColor } from '@/ui/identity';
import { useCurrency } from '../currency';
import type { CategoryTotal } from '../logic';
import styles from '../routes/finance.module.css';

/** Where the month's money went: the ring in the module hue, a legend with every amount (the legend is the content). */
export function CategoryRing({ rows }: { rows: CategoryTotal[] }) {
  const currency = useCurrency();
  if (rows.length === 0) return null;
  const top = rows.slice(0, 5);
  return (
    <Card>
      <h2 className={styles.chartTitle}>{t.finance.ringTitle}</h2>
      <div className={styles.ringRow}>
        <Ring
          label={t.finance.categoriesRing(rows.length)}
          centre={rows.length}
          parts={top.map((r) => ({ label: r.name, share: r.amountMinor }))}
        />
        <ul className={styles.legend}>
          {top.map((r, i) => (
            <li key={r.categoryId ?? r.name}>
              <i
                className={styles.swatch}
                style={{ background: ringColor(i) }}
                aria-hidden="true"
              />
              <span>{r.name}</span>
              <b>{formatMoney(r.amountMinor, currency)}</b>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
