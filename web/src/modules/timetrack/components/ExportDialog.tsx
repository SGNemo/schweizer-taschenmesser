import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { getPlatform } from '@/core/platform';
import { monthOf, today } from '@/core/time/dates';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Dialog, patternStyles, TextField } from '@/ui';
import { buildCsv } from '../logic';
import type { Entry, Project } from '../schema';

export function ExportDialog({
  open,
  entries,
  projects,
  onClose,
}: {
  open: boolean;
  entries: readonly Stored<Entry>[];
  projects: readonly Stored<Project>[];
  onClose: () => void;
}) {
  const [month, setMonth] = useState(() => monthOf(today()));
  const toast = useUiStore((s) => s.toast);
  const inMonth = entries.filter(
    (e) => e.date.startsWith(month) && typeof e.startedAt !== 'number',
  );

  async function save() {
    const csv = buildCsv(entries, new Map(projects.map((p) => [p.id, p])), month, t.timetrack.csv);
    const r = await getPlatform().saveFile({
      fileName: `Stundenzettel-${month}.csv`,
      data: csv,
      mime: 'text/csv;charset=utf-8',
    });
    if (r === 'saved') {
      toast(t.timetrack.exported);
      onClose();
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t.timetrack.export}>
      <TextField
        label={t.timetrack.exportMonth}
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        data-autofocus
      />
      {month && inMonth.length === 0 ? <p role="status">{t.timetrack.noEntriesMonth}</p> : null}
      <div className={`${patternStyles.hstack} ${patternStyles.gapTop}`}>
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button
          variant="primary"
          disabled={!month || inMonth.length === 0}
          onClick={() => void save()}
        >
          {t.timetrack.exportButton}
        </Button>
      </div>
    </Dialog>
  );
}
