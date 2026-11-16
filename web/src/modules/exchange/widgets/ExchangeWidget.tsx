import { useLiveQuery } from 'dexie-react-hooks';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { StatusWidget } from '@/ui';
import { itemRepo } from '../repo';

/**
 * Home screen: what is new from the other device (not looked at since the page was open), never
 * a counter that only grows – it clears when the page is opened. One action: open the page.
 */
export default function ExchangeWidget() {
  const fresh = useLiveQuery(
    async () => (await itemRepo.active().filter((r) => r.direction === 'in' && r.unseen).toArray()).length,
    [],
  );
  if (!getPlatform().exchange.side) {
    return <StatusWidget icon="swap" state={t.exchange.unsupported} />;
  }
  return (
    <StatusWidget
      icon="swap"
      state={fresh ? t.exchange.widget.fresh(fresh) : t.exchange.widget.nothing}
      action={{ label: t.exchange.widget.open, to: '/exchange' }}
    />
  );
}
