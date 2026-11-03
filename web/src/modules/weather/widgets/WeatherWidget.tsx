import { dateTimeFormat } from '@/core/i18n/format';
import { useWeatherSettings } from '@/core/weather/settings';
import { useWeather } from '@/core/weather/useWeather';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { KpiWidget } from '@/ui';
import { Sky, skyKind } from '@/ui/identity';
import styles from '../routes/weather.module.css';

/**
 * Overview widget: only what matters today (sky swatch, temperature, word, the rain hint), the rest is one tap away in the
 * module. No place yet: one calm next step. Reads the cached forecast of the main place, never asks more than the page does.
 */
export default function WeatherWidget() {
  const tx = tWeather.use();
  const tp = tWeatherPage.use();
  const [settings] = useWeatherSettings();
  const weather = useWeather();
  const noPlace = !!settings && settings.place === '';
  const stale = weather?.stale
    ? tx.asOf(dateTimeFormat({ hour: '2-digit', minute: '2-digit' }).format(weather.at))
    : undefined;
  return (
    <div className={styles.widget} data-testid="weather-widget">
      {weather ? (
        <span className={styles.widgetSky}>
          <Sky kind={skyKind(weather.forecast.group, !!weather.forecast.now?.night)} compact />
        </span>
      ) : null}
      <KpiWidget
        loading={!settings || (!weather && !noPlace)}
        value={weather ? tx.temp(weather.forecast.temp) : undefined}
        label={weather?.place.split(',')[0]}
        context={
          weather
            ? [
                tx.codes[weather.forecast.group],
                weather.forecast.rainFrom && !weather.stale
                  ? tp.widgetRain(weather.forecast.rainFrom)
                  : tp.widgetDry,
                stale,
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        empty={tp.widgetEmpty}
        emptyAction={{ label: tp.widgetAction, to: '/weather' }}
      />
    </div>
  );
}
