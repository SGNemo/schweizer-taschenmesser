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
 * Ticks or unticks one row. Rows are linked by `dependsOn` (a task and its new list, a subtask and
 * its new parent), also in a chain: unticking the row others depend on unticks them too, ticking a
 * dependent row ticks what it needs.
 */
export function toggleRow(rows: PreviewRow[], index: number, selected: boolean): PreviewRow[] {
  const target = rows.find((r) => r.index === index);
  if (!target) return rows;
  const change = new Set([index]);
  if (selected) {
    let need = target.candidate.dependsOn;
    while (need) {
      const row = rows.find((x) => x.candidate.id === need);
      if (!row || change.has(row.index)) break;
      // A row whose new list is invalid cannot be imported (the commit guard would drop it
      // silently): it stays unticked instead of looking selected.
      if (row.invalid) return rows;
      change.add(row.index);
      need = row.candidate.dependsOn;
    }
  } else {
    const open = [target.candidate.id];
    while (open.length) {
      const id = open.pop();
      for (const x of rows) {
        if (!id || x.candidate.dependsOn !== id || change.has(x.index)) continue;
        change.add(x.index);
        open.push(x.candidate.id);
      }
    }
  }
  return rows.map((x) => (change.has(x.index) ? { ...x, selected } : x));
}

export function ImportPreview({
  rows,
  onChange,
}: {
  rows: PreviewRow[];
  onChange: (rows: PreviewRow[]) => void;
}) {
  const allSelected = rows.every((r) => r.invalid || r.selected);
  const duplicates = rows.filter((r) => r.duplicate && !r.invalid).length;
  const invalid = rows.filter((r) => r.invalid).length;
  return (
    <>
      <div className={styles.bar}>
        <strong>{t.onboarding.found(rows.length)}</strong>
        {duplicates + invalid > 0 ? (
          <span className={styles.muted} data-testid="preview-counts">
            {t.onboarding.previewCounts(rows.length - duplicates - invalid, duplicates, invalid)}
          </span>
        ) : null}
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
