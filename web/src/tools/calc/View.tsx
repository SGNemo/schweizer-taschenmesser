import { useState } from 'react';
import { t } from '@/strings';
import { Segmented } from '@/ui';
import styles from '../tools.module.css';
import ExprMode from './ExprMode';
import PercentMode from './PercentMode';
import SplitMode from './SplitMode';

const s = t.tools.calc;
const MODES = ['expr', 'percent', 'split'] as const;
type Mode = (typeof MODES)[number];

export default function CalcTool() {
  const [mode, setMode] = useState<Mode>('expr');
  return (
    <div className={styles.stack}>
      <Segmented
        label={s.modesLabel}
        value={mode}
        options={MODES.map((m) => ({ value: m, label: s.modes[m]! }))}
        onChange={setMode}
      />
      {mode === 'expr' ? <ExprMode /> : mode === 'percent' ? <PercentMode /> : <SplitMode />}
    </div>
  );
}
