import { Link } from 'react-router';
import { dateTimeFormat } from '@/core/i18n/format';
import { settingsPath } from '@/core/settings/registry/paths';
import { now } from '@/core/time/now';
import {
  dayRows,
  hourRows,
  placeNowIso,
  RAIN_SHOWN_PERCENT,
  type CodeGroup,
} from '@/core/weather/logic';
import type { WeatherView } from '@/core/weather/useWeather';
import { tWeather } from '@/strings.weather';
import { Dialog, GroupedList, Icon } from '@/ui';
import styles from './WeatherPreview.module.css';

const SETTINGS = settingsPath('verbindungen', 'weather');

/** The few icons the set has: sun for a clear sky, a thermometer for everything else. No colour, no warning. */
const iconFor = (group: CodeGroup) =>
  group === 'clear' || group === 'partly' ? 'sun' : 'thermometer';

const localDate = (iso: string, hour = 0): Date =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), hour);

/**
 * The calm preview behind the weather line: the next 12 hours and the next six days of the chosen place,
 * one text row each, no colour, no graphic. "Stand hh:mm" when the values are older than 30 minutes;
 * a link to the settings and the Open-Meteo credit at the bottom.
 */
export function WeatherPreview({
  open,
  onClose,
  weather,
}: {
  open: boolean;
  onClose: () => void;
  weather: WeatherView;
}) {
  const tx = tWeather.use();
  const { forecast, place, stale, at } = weather;
  const nowIso = placeNowIso(forecast, at, now());
  const hours = hourRows(forecast, nowIso);
  const days = dayRows(forecast, nowIso.slice(0, 10));
  const ready = !!forecast.hours && !!forecast.days;
  const hourFmt = dateTimeFormat({ hour: '2-digit', minute: '2-digit' });
  const dayFmt = dateTimeFormat({ weekday: 'short' });
  const rain = (n: number) => (n >= RAIN_SHOWN_PERCENT ? ` · ${tx.rainChance(n)}` : '');

  return (
    <Dialog open={open} onClose={onClose} title={place.split(',')[0]!}>
      <div className={styles.preview} data-testid="weather-preview">
        {stale ? <p className={styles.asOf}>{tx.asOf(hourFmt.format(at))}</p> : null}
        {ready ? (
          <GroupedList
            listId="weather"
            groups={[
              {
                id: 'today',
                label: tx.today,
                count: hours.length,
                children: (
                  <ul className={styles.rows} data-testid="weather-hours">
                    {hours.map((h) => (
                      <li key={h.time} className={styles.row}>
                        <Icon name={iconFor(h.group)} size={16} />
                        <span>
                          {hourFmt.format(localDate(h.time, Number(h.time.slice(11, 13))))} ·{' '}
                          {tx.temp(h.temp)} · {tx.codes[h.group]}
                          {rain(h.rain)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ),
              },
              {
                id: 'days',
                label: tx.nextDays,
                count: days.length,
                children: (
                  <ul className={styles.rows} data-testid="weather-days">
                    {days.map((d) => (
                      <li key={d.date} className={styles.row}>
                        <Icon name={iconFor(d.group)} size={16} />
                        <span>
                          {dayFmt.format(localDate(d.date))} · {tx.range(d.min, d.max)} ·{' '}
                          {tx.codes[d.group]}
                          {rain(d.rain)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ),
              },
            ]}
          />
        ) : (
          <p className={styles.loading}>{tx.previewLoading}</p>
        )}
        <p className={styles.foot}>
          <Link to={SETTINGS} onClick={onClose}>
            {tx.settings}
          </Link>
        </p>
        <p className={styles.foot} data-testid="weather-preview-credit">
          {tx.attribution}{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer noopener">
            {tx.attributionLink}
          </a>
        </p>
      </div>
    </Dialog>
  );
}
