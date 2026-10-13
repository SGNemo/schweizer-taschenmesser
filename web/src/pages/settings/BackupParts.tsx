import { formatTimestamp, DATE_TIME_NUMERIC } from '@/core/i18n/format';
import type { RestorePlan } from '@/core/backup/restore';
import type { VerifyReport } from '@/core/backup/verify';
import { allManifests } from '@/core/modules/registry';
import { t } from '@/strings';
import styles from './settings.module.css';

const moduleLabel = (id: string): string =>
  id === 'core' ? t.backup.core : (allManifests.find((m) => m.id === id)?.name ?? id);

export function VerifyReportView({ report }: { report: VerifyReport }) {
  return (
    <div data-testid="backup-verify">
      <p role={report.ok ? 'status' : 'alert'} className={report.ok ? undefined : styles.error}>
        {report.ok
          ? t.backup.verifyOk
          : `${t.backup.verifyFailed} ${t.backup.errors[report.failure ?? 'invalid'] ?? ''}`}
      </p>
      <ul className={styles.muted}>
        {report.steps.map((s) => (
          <li key={s.id}>
            {t.backup.steps[s.id]}: {t.backup.stepStatus[s.status]}
          </li>
        ))}
      </ul>
      {report.ok ? (
        <>
          <p className={styles.muted}>
            {t.backup.verifyTotals(report.totals.records, report.totals.tombstones)}
            {report.exportedAt
              ? ` · ${t.backup.verifyExported(formatTimestamp(new Date(report.exportedAt).getTime(), DATE_TIME_NUMERIC))}`
              : ''}
          </p>
          <ul className={styles.muted}>
            {report.modules.map((m) => (
              <li key={m.module}>
                {moduleLabel(m.module)}: {m.records}
                {m.tombstones > 0 ? t.backup.deletedCount(m.tombstones) : ''}
              </li>
            ))}
          </ul>
          {report.skippedTables > 0 ? (
            <p className={styles.muted}>{t.backup.verifySkipped(report.skippedTables)}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function PlanView({ plan }: { plan: RestorePlan }) {
  const { added, replaced, removed } = plan.totals;
  const changed = plan.modules.filter((m) => m.added + m.replaced + m.removed > 0);
  return (
    <div data-testid="backup-plan">
      <p className={styles.legend}>{t.backup.previewTitle}</p>
      {changed.length === 0 ? (
        <p className={styles.muted}>{t.backup.previewNothing}</p>
      ) : (
        <>
          <ul className={styles.muted}>
            {changed.map((m) => (
              <li key={m.module}>
                {t.backup.previewRow(moduleLabel(m.module), m.added, m.replaced, m.removed)}
              </li>
            ))}
          </ul>
          <p>{t.backup.previewTotals(added, replaced, removed)}</p>
        </>
      )}
      {plan.skippedTables > 0 ? (
        <p className={styles.muted} data-testid="backup-skipped">
          {t.backup.skippedOnRestore(plan.skippedTables)}
        </p>
      ) : null}
      <p className={styles.muted}>{t.backup.safetyNote}</p>
    </div>
  );
}
