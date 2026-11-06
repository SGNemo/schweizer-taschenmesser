/**
 * Settings → Sync & Backup: the "Umzug von einer anderen App" card. One way in (the sheet), the last
 * runs with an undo each, and the checklist of the setup assistant behind a quiet button.
 */
import { useState } from 'react';
import { openAppImport } from '@/core/importer/appImportStore';
import { undoRun, useImportRuns } from '@/core/importer/runs';
import { getManifest } from '@/core/modules/registry';
import { formatDay, toDateString } from '@/core/time/dates';
import { MigratePicker } from '@/layout/setup/steps/MigrateStep';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Badge, Button, Card, Dialog, EmptyState } from '@/ui';
import { SignatureMark } from '@/ui/identity';
import styles from './settings.module.css';

export function MoveCard() {
  const text = t.importers;
  const runs = useImportRuns();
  const toast = useUiStore((s) => s.toast);
  const [checklist, setChecklist] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function undo(groupId: string) {
    setBusy(groupId);
    try {
      const { removed, kept } = await undoRun(groupId);
      toast(t.onboarding.undone(removed, kept));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <div className={styles.form} data-testid="move-card">
        <div className={styles.row}>
          <div>
            <strong>{text.title}</strong>
            <p className={styles.muted}>{text.intro}</p>
          </div>
          <Button variant="primary" data-testid="appimport-open" onClick={() => openAppImport()}>
            {text.start}
          </Button>
        </div>
        {runs && runs.length > 0 ? (
          <section aria-label={text.recentTitle}>
            <strong>{text.recentTitle}</strong>
            <ul className={styles.form} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {runs.slice(0, 5).map((run) => (
                <li key={run.groupId} className={styles.row}>
                  <span>
                    {text.recentRun(
                      run.source,
                      formatDay(toDateString(new Date(run.createdAt)), 'd. MMM yyyy'),
                    )}
                    <span className={styles.muted}>
                      {' · '}
                      {run.parts
                        .map((p) =>
                          text.runPart(getManifest(p.moduleId)?.name ?? p.moduleId, p.count),
                        )
                        .join(', ')}
                    </span>
                  </span>
                  {run.undone ? (
                    <Badge>{t.onboarding.recentUndone}</Badge>
                  ) : (
                    <Button disabled={busy === run.groupId} onClick={() => void undo(run.groupId)}>
                      {text.undoRunShort}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : runs ? (
          <EmptyState
            title={text.emptyTitle}
            motif={<SignatureMark id="arrowProgress" size={64} />}
          >
            <p>{text.emptyText}</p>
          </EmptyState>
        ) : null}
        <div className={styles.row}>
          <span className={styles.muted}>{text.checklistHint}</span>
          <Button variant="ghost" data-testid="migrate-open" onClick={() => setChecklist(true)}>
            {text.checklist}
          </Button>
        </div>
      </div>
      <Dialog
        open={checklist}
        onClose={() => setChecklist(false)}
        title={t.setup.steps.migrate.title}
        footer={<Button onClick={() => setChecklist(false)}>{t.actions.close}</Button>}
      >
        <p>{t.setup.steps.migrate.description}</p>
        {checklist ? <MigratePicker onLeave={() => setChecklist(false)} /> : null}
      </Dialog>
    </Card>
  );
}
