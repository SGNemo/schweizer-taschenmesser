import { useLiveQuery } from 'dexie-react-hooks';
import { useFormatLocale } from '@/core/i18n/format';
import { localZone } from '@/core/time/placeSearch';
import { useMinuteNow } from '@/core/time/useMinuteNow';
import { t } from '@/strings';
import { KachelnBody, WidgetBody, useWidgetSize } from '@/ui';
import { listPlaces } from '../repo';
import { placeLine } from '../view';

/**
 * The places as tiles: the time large, the name, and "Nacht · morgen · +8 h" as the context line (day or night in
 * words, never colour alone). 2 / 4 / 6 places by size; the minute turns once, nothing ticks in between.
 */
export default function ClockWidget() {
  useFormatLocale();
  const at = useMinuteNow();
  const size = useWidgetSize();
  const places = useLiveQuery(listPlaces, []);
  const here = localZone();
  const shown = (places ?? []).slice(0, size === 's' ? 2 : size === 'm' ? 4 : 6);
  return (
    <WidgetBody
      loading={!places}
      isEmpty={places?.length === 0}
      empty={t.clock.widget.empty}
      emptyAction={{ label: t.clock.widget.add, to: '/clock?new=1' }}
    >
      <KachelnBody
        tiles={shown.map((p) => {
          const line = placeLine(at, p.zone, here);
          return {
            key: p.id,
            value: line.shown,
            label: p.label,
            state: `${line.dayPart} · ${line.context}`,
            to: '/clock',
          };
        })}
      />
    </WidgetBody>
  );
}
