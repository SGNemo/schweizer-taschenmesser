import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { useSummary } from './useSummary';

export default function SummaryWidget() {
  const open = useSummary();
  return (
    <WidgetList
      loading={!open}
      empty={t.example.empty}
      emptyAction={{ label: t.example.add, to: '/example?new=1' }}
      entries={(open ?? []).map((e) => ({ key: e.id, title: e.title }))}
      to="/example"
      linkLabel={t.example.open}
    />
  );
}
