import type { Stored } from '@/core/db/types';
import { formatDay, relativeDayLabel } from '@/core/time/dates';
import { t } from '@/strings';
import { tDeadline } from '@/strings.deadline';
import { Button, DetailPanel } from '@/ui';
import { cancelDeadline, endOf, formatSize, statusOf } from '../logic';
import type { VaultDocument } from '../schema';

/**
 * The document picked in the list, in the panel of the wide page (master–detail): what the folder's small print
 * says, as a list of facts, and the note. Changing it is the dialog behind "Bearbeiten"; renewing and downloading
 * stay the folder's own buttons and are not repeated here.
 */
export function DocumentDetail({
  doc: d,
  day,
  hasFile,
  onEdit,
  onClose,
}: {
  doc: Stored<VaultDocument>;
  day: string;
  hasFile: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const state = statusOf(d, day);
  const end = endOf(d);
  const deadline = cancelDeadline(d);
  const long = (date: string) => formatDay(date, 'd. MMMM yyyy');
  const facts = [
    ...(d.provider ? [{ label: t.vault.provider, value: d.provider }] : []),
    ...(d.startDate ? [{ label: t.vault.startDate, value: long(d.startDate) }] : []),
    ...(end ? [{ label: t.vault.endLabel, value: long(end) }] : []),
    ...(deadline
      ? [
          {
            label: t.vault.deadlineLabel,
            value:
              state === 'missed'
                ? tDeadline.get().missedOn(long(deadline))
                : deadline >= day
                  ? `${long(deadline)} · ${relativeDayLabel(deadline, day)}`
                  : long(deadline),
          },
        ]
      : []),
    ...(d.fileName
      ? [
          {
            label: t.vault.file,
            value: [
              d.fileName,
              d.fileSize !== undefined ? formatSize(d.fileSize) : '',
              hasFile ? '' : t.vault.fileElsewhere,
            ]
              .filter(Boolean)
              .join(' · '),
          },
        ]
      : []),
    ...(d.note ? [{ label: t.form.note, value: d.note }] : []),
  ];
  return (
    <DetailPanel
      testId="document-detail"
      eyebrow={t.vault.categories[d.category]}
      title={d.title}
      facts={facts}
      onClose={onClose}
      actions={
        <Button onClick={onEdit} data-row-edit>
          {t.actions.edit}
        </Button>
      }
    >
      {facts.length === 0 ? <p>{t.vault.detail.bare}</p> : null}
    </DetailPanel>
  );
}
