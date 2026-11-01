/**
 * The rules the bank import has learned, folded away under the categories. Only shown when there is
 * at least one; removing a rule never changes an existing booking.
 */
import { useEffect, useState } from 'react';
import { listSubscriptionNames } from '@/modules/subscriptions/public';
import { t } from '@/strings';
import { Button, Icon } from '@/ui';
import type { Category } from '../schema';
import type { BankRule } from '../rules';
import { loadRules, removeRule } from '../rulesStore';
import styles from '../routes/finance.module.css';

export function RulesList({
  categories,
}: {
  categories: { id: string; name: Category['name'] }[];
}) {
  const [rules, setRules] = useState<BankRule[]>([]);
  const [subs, setSubs] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    let alive = true;
    void Promise.all([loadRules(), listSubscriptionNames()]).then(([r, s]) => {
      if (alive) {
        setRules(r);
        setSubs(s);
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  if (rules.length === 0) return null;
  const s = t.finance.rules;
  return (
    <details className={styles.rulesBox}>
      <summary>{s.manageTitle}</summary>
      <p className={styles.muted}>{s.manageHint}</p>
      <ul className={styles.list}>
        {rules.map((r) => (
          <li key={r.id} className={styles.ruleRow}>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>{r.match}</span>
              <span className={styles.muted}>
                {[
                  subs.find((x) => x.id === r.subscriptionId)?.name,
                  categories.find((c) => c.id === r.categoryId)?.name,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <Button
              aria-label={s.remove(r.match)}
              onClick={() => {
                void removeRule(r.id).then(() => setRules(rules.filter((x) => x.id !== r.id)));
              }}
            >
              <Icon name="trash" size={18} />
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}
