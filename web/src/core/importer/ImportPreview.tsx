/**
 * The preview list shared by the start-data wizard and the review of imports sent by an AI: one
 * checkbox per entry, badges for duplicates / invalid entries / warnings, and for changes of
 * existing entries the diff ("Feld: alt → neu"). Changes are never pre-ticked.
 */
import { t } from '@/strings';
import { Badge, Button, Checkbox } from '@/ui';
import type { PreviewRow } from './types';
import styles from './OnboardingWizard.module.css';

/**
 * Ticks or unticks one row. Rows are linked by `dependsOn` (a task and its new list): unticking the
 * row others depend on unticks them too, ticking a dependent row ticks what it needs.
 */
export function toggleRow(rows: PreviewRow[], index: number, selected: boolean): PreviewRow[] {
  const target = rows.find((r) => r.index === index);
  const id = target?.candidate.id;
  const need = target?.candidate.dependsOn;
  // A row whose new list is invalid cannot be imported (the commit guard would drop it silently):
  // it stays unticked instead of looking selected.
  if (selected && need && rows.some((x) => x.candidate.id === need && x.invalid)) return rows;
  return rows.map((x) => {
    if (x.index === index) return { ...x, selected };
    if (selected && need && x.candidate.id === need && !x.invalid) return { ...x, selected };
    if (!selected && id && x.candidate.dependsOn === id) return { ...x, selected };
    return x;
  });
}

export function ImportPreview({
  rows,
  onChange,
}: {
  rows: PreviewRow[];
  onChange: (rows: PreviewRow[]) => void;
}) {
  const allSelected = rows.every((r) => r.invalid || r.selected);
  return (
    <>
      <div className={styles.bar}>
        <strong>{t.onboarding.found(rows.length)}</strong>
        <Button
          onClick={() =>
            onChange(rows.map((r) => ({ ...r, selected: !r.invalid && !allSelected })))
          }
        >
          {allSelected ? t.onboarding.selectNone : t.onboarding.selectAll}
        </Button>
      </div>
      <ul className={styles.rows} aria-label={t.onboarding.previewTitle}>
        {rows.map((r) => {
          const update = r.candidate.update;
          return (
            <li key={r.index} className={styles.row}>
              <Checkbox
                checked={r.selected}
                disabled={Boolean(r.invalid)}
                onChange={(e) => onChange(toggleRow(rows, r.index, e.target.checked))}
                label={
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{r.candidate.label}</span>
                    {r.candidate.detail ? (
                      <span className={styles.muted}>{r.candidate.detail}</span>
                    ) : null}
                    {update && !r.duplicate && !r.invalid ? (
                      <span className={styles.diff}>
                        {update.lines.map((line) => (
                          <span key={line.field}>
                            {line.field}: <del>{line.from}</del> → <ins>{line.to}</ins>
                          </span>
                        ))}
                      </span>
                    ) : null}
                    {r.duplicate || r.invalid || r.candidate.warning || update ? (
                      <span className={styles.badges}>
                        {update ? <Badge tone="accent">{t.onboarding.change}</Badge> : null}
                        {r.duplicate ? (
                          <Badge>{update ? t.onboarding.unchanged : t.onboarding.duplicate}</Badge>
                        ) : null}
                        {r.invalid ? <Badge>{t.onboarding.invalid}</Badge> : null}
                        {r.candidate.warning ? <Badge>{r.candidate.warning}</Badge> : null}
                      </span>
                    ) : null}
                    {r.invalid && r.candidate.error ? (
                      <span className={styles.muted}>{r.invalid}</span>
                    ) : null}
                  </span>
                }
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}
