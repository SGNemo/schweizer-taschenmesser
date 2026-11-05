import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { KennzahlBody, WidgetBody } from '@/ui';
import { stateGroup, statusOf } from '../logic';
import { documentRepo } from '../repo';

/**
 * `kennzahl` (identity v3.1, G03/F04): the most pressing state as the figure ("Abgelaufen 3"), the other states and
 * the total as its context line. Counts only: no document title, file or provider is read into the overview.
 */
export default function ExpiringWidget() {
  const docs = useLiveQuery(() => documentRepo.active().toArray(), []);
  const day = today();
  const groups = (docs ?? []).map((d) => stateGroup(statusOf(d, day)));
  const expired = groups.filter((g) => g === 'expired').length;
  const due = groups.filter((g) => g === 'due').length;
  const total = groups.length;
  const figure =
    expired > 0
      ? {
          value: expired,
          label: t.vault.stateGroups.expired,
          context: t.vault.widgetRest(due, total),
        }
      : due > 0
        ? { value: due, label: t.vault.stateGroups.due, context: t.vault.widgetRest(0, total) }
        : { value: total, label: t.vault.figureUnit, context: t.vault.widgetEmpty };
  return (
    <WidgetBody
      loading={!docs}
      isEmpty={total === 0}
      empty={t.vault.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.vault, to: '/vault?new=1' }}
    >
      <KennzahlBody value={String(figure.value)} label={figure.label} context={figure.context} />
    </WidgetBody>
  );
}
