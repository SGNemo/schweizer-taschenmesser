import { z } from 'zod';
import type { AngleMode } from '@/core/calc/engine';
import { useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { Tabs } from '@/ui';
import styles from '../tools.module.css';
import DateMode from './DateMode';
import ExprMode from './ExprMode';
import FinanceMode from './FinanceMode';
import ProgrammerMode from './ProgrammerMode';
import UnitsMode from './UnitsMode';

const s = t.tools.calc;
export const MODES = ['standard', 'scientific', 'programmer', 'finance', 'date', 'units'] as const;
export type Mode = (typeof MODES)[number];

/** Which tab was open last and the angle unit; per device user preferences, synced like other settings. */
const schema = z.object({
  mode: z.enum(MODES).catch('standard'),
  angle: z.enum(['deg', 'rad']).catch('deg'),
});

export default function CalcTool() {
  const [stored, patch] = useSettings('tools.calc', schema, { mode: 'standard', angle: 'deg' });
  if (!stored) return null;
  const mode: Mode = stored.mode;
  const angle: AngleMode = stored.angle;
  return (
    <div className={styles.stack}>
      <Tabs
        label={s.modesLabel}
        items={MODES.map((m) => ({ id: m, label: s.modes[m]!, active: m === mode }))}
        onSelect={(id) => void patch({ mode: id as Mode })}
      />
      {mode === 'standard' || mode === 'scientific' ? (
        <ExprMode
          key={mode}
          scientific={mode === 'scientific'}
          angle={angle}
          onAngle={(a) => void patch({ angle: a })}
        />
      ) : mode === 'programmer' ? (
        <ProgrammerMode />
      ) : mode === 'finance' ? (
        <FinanceMode />
      ) : mode === 'date' ? (
        <DateMode />
      ) : (
        <UnitsMode />
      )}
    </div>
  );
}
