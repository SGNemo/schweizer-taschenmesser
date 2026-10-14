import { today } from '@/core/time/dates';
import { DATE_PRESETS, presetDate } from '@/core/time/quickShift';
import { t } from '@/strings';
import { Chip, Chips } from './Patterns';

/**
 * Quick picks under a date field ("Heute", "Morgen", "Nächste Woche"): one tap instead of the
 * native date picker. The field stays the source of truth; the chip of the current value is on.
 */
export function DateChips({
  value,
  onChange,
  from = today(),
}: {
  value: string;
  onChange: (date: string) => void;
  /** Reference day for the presets (default today). */
  from?: string;
}) {
  return (
    <Chips label={t.ui.datePresetsLabel}>
      {DATE_PRESETS.map((p) => {
        const date = presetDate(p, from);
        return (
          <Chip
            key={p}
            label={t.ui.datePresets[p]}
            selected={value === date}
            onClick={() => onChange(date)}
          />
        );
      })}
    </Chips>
  );
}
