import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { useSummary } from './useSummary';

// TODO: move these texts to src/strings.ts (all UI text lives there, German only).
const LINK = 'Planer öffnen';

/**
 * Home-screen widget. Contract: lazy default export, live data, an empty state that offers a
 * next step (`emptyAction`), nothing heavy. Registered in `manifest.ts` under `widgets`.
 */
export default function SummaryWidget() {
  const open = useSummary();
  return (
    <WidgetList
      loading={!open}
      empty={t.planner.empty}
      emptyAction={{ label: t.planner.add, to: '/planner?new=1' }}
      entries={(open ?? []).map((e) => ({ key: e.id, title: e.title }))}
      to="/planner"
      linkLabel={LINK}
    />
  );
}
