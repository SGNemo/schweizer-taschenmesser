import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Checkbox } from '../Fields';
import { useWidgetSize, rowsFor } from './size';
import { StateBadge } from './StateBadge';
import type { DueTone } from '@/core/time/due';
import { WidgetBody, type WidgetEmpty } from './WidgetBody';
import styles from './Widgets.module.css';

export interface ChecklistEntry {
  key: string;
  title: string;
  checked: boolean;
  /** Optional due state shown on the right. */
  tone?: DueTone;
  label?: string;
}

/**
 * Checklist widget: tick directly in the widget. A tick runs `onToggle(key, checked)` and offers
 * "Rückgängig" in a toast that runs the opposite toggle. 3 / 5 / 8 rows.
 */
export function ChecklistWidget({
  loading,
  summary,
  entries,
  onToggle,
  doneMessage,
  ...emptyProps
}: WidgetEmpty & {
  loading: boolean;
  summary?: string;
  entries: ChecklistEntry[];
  onToggle: (key: string, checked: boolean) => void | Promise<void>;
  /** Toast text after ticking, default "Erledigt". */
  doneMessage?: (title: string) => string;
}) {
  const size = useWidgetSize();
  const toast = useUiStore((s) => s.toast);
  const shown = entries.slice(0, rowsFor(size, [3, 5, 8]));

  async function toggle(e: ChecklistEntry) {
    const next = !e.checked;
    await onToggle(e.key, next);
    if (next)
      toast(doneMessage?.(e.title) ?? t.widgets.done, {
        label: t.widgets.undo,
        run: () => void onToggle(e.key, false),
      });
  }

  return (
    <WidgetBody loading={loading} isEmpty={entries.length === 0} {...emptyProps}>
      {summary ? <p className={styles.summary}>{summary}</p> : null}
      <ul className={styles.rows}>
        {shown.map((e) => (
          <li key={e.key} className={styles.checkRow}>
            <Checkbox label={e.title} checked={e.checked} onChange={() => void toggle(e)} />
            {e.tone && e.label ? <StateBadge tone={e.tone} label={e.label} /> : null}
          </li>
        ))}
      </ul>
    </WidgetBody>
  );
}
