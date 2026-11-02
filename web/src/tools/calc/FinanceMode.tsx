import { useState } from 'react';
import { t } from '@/strings';
import { SelectField } from '@/ui';
import styles from '../tools.module.css';
import { DiscountPanel, InterestPanel, LoanPanel } from './FinancePanels';
import PercentMode from './PercentMode';
import SplitMode from './SplitMode';

const s = t.tools.calc.pro.finance;
const PARTS = ['percent', 'discount', 'interest', 'loan', 'split'] as const;
type Part = (typeof PARTS)[number];

export default function FinanceMode() {
  const [part, setPart] = useState<Part>('percent');
  return (
    <div className={styles.stack}>
      <SelectField
        label={t.tools.calc.modes.finance!}
        value={part}
        onChange={(e) => setPart(e.target.value as Part)}
      >
        {PARTS.map((p) => (
          <option key={p} value={p}>
            {s.tabs[p]}
          </option>
        ))}
      </SelectField>
      {part === 'percent' ? (
        <PercentMode />
      ) : part === 'discount' ? (
        <DiscountPanel />
      ) : part === 'interest' ? (
        <InterestPanel />
      ) : part === 'loan' ? (
        <LoanPanel />
      ) : (
        <SplitMode />
      )}
    </div>
  );
}
