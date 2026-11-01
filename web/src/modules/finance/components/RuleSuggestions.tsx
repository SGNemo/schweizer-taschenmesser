/**
 * Below the import preview: "Always book Netflix as …?" – one calm line per new payee, nothing
 * ticked. A rule is only created for what the user ticks, and only when the import is confirmed.
 */
import { useState } from 'react';
import { t } from '@/strings';
import { Checkbox } from '@/ui';
import type { RuleProposal } from '../rules';
import styles from './ruleSuggestions.module.css';

export function RuleSuggestions({
  proposals,
  chosen,
  onToggle,
}: {
  proposals: { proposal: RuleProposal; label: string }[];
  /** Shared with the importer: the matches the user ticked. */
  chosen: Set<string>;
  onToggle: (proposal: RuleProposal, on: boolean) => void;
}) {
  const [, rerender] = useState(0);
  return (
    <section className={styles.box} aria-label={t.finance.rules.title}>
      <h4 className={styles.title}>{t.finance.rules.title}</h4>
      <p className={styles.hint}>{t.finance.rules.hint}</p>
      <ul className={styles.list}>
        {proposals.map(({ proposal, label }) => (
          <li key={proposal.match}>
            <Checkbox
              checked={chosen.has(proposal.match)}
              onChange={(e) => {
                if (e.target.checked) chosen.add(proposal.match);
                else chosen.delete(proposal.match);
                rerender((n) => n + 1);
                onToggle(proposal, e.target.checked);
              }}
              label={label}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
