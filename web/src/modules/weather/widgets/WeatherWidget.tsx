import { dateTimeFormat } from '@/core/i18n/format';
import { useWeatherSettings } from '@/core/weather/settings';
import { useWeather } from '@/core/weather/useWeather';
import { placeNowIso, rainsNow } from '@/core/weather/logic';
import { conditionId, inkOf, sceneHourOf } from '@/core/weather/scene';
import { now } from '@/core/time/now';
import { tWeather } from '@/strings.weather';
import { tWeatherPage } from '@/strings.weatherPage';
import { KpiWidget } from '@/ui';
import { CARD_QUIET_SHARE, ScenePorthole, useSmallScene, WeatherScene } from '@/ui/weather-scene';
import { useMoon } from '../useMoon';
import styles from '../routes/weather.module.css';

/**
 * Overview widget: only what matters today (place, temperature, word, the rain hint), the rest is one tap away in the
 * module. With a forecast the card carries the weather scene as its background (variant B, the one named exception
 * to "a widget is a tone step", MODULE-IDENTITY "Widgets"): the text on the quiet left in the scene's ink, the rain
 * hint as an opaque chip, never moving; the picture fills the room under the text at every size (`cardFit`). "Ruhig"
 * and "Modulfarben: Aus" keep the plain card with the 64 px porthole (variant A). No place yet: one calm next step. Reads the cached forecast of the main place, never asks more than the
 * page does; the moon is the page's (`useMoon`), absent while "Mond und Himmelsereignisse" is off.
 */
export default function WeatherWidget() {
  const tx = tWeather.use();
  const tp = tWeatherPage.use();
  const [settings] = useWeatherSettings();
  const weather = useWeather();
  const noPlace = !!settings && settings.place === '';
  const lat = settings?.lat ?? 0;
  const moon = useMoon(lat, settings?.lon ?? 0, weather?.forecast.tz, !!weather);
  const scene = useSmallScene(weather, lat, moon);
  const stale = weather?.stale
    ? tx.asOf(dateTimeFormat({ hour: '2-digit', minute: '2-digit' }).format(weather.at))
    : undefined;
  const word = weather
    ? tx.conditions[
        conditionId(
          weather.forecast.code,
          weather.forecast.group,
          sceneHourOf(weather.forecast, placeNowIso(weather.forecast, weather.at, now())),
        )
      ]
    : undefined;
  // While it rains the word already says so: no rain hint (never "no rain in sight").
  const rain =
    !weather || rainsNow(weather.forecast.code, weather.forecast.group)
      ? undefined
      : weather.forecast.rainFrom && !weather.stale
        ? tp.widgetRain(weather.forecast.rainFrom)
        : tp.widgetDry;
  if (weather && scene && !scene.calm)
    return (
      <div
        className={styles.widgetScene}
        data-testid="weather-widget"
        data-variant="scene"
        data-ink={inkOf(scene)}
      >
        <div className={styles.widgetBackdrop}>
          <WeatherScene state={scene} quietShare={CARD_QUIET_SHARE} />
        </div>
        {/* The `kennzahl` shape (place, figure, context line) in the scene's ink; the rain hint closes the context
            line as an opaque chip, so the card keeps the height of variant A. */}
        <div className={styles.widgetText} data-body="kennzahl" data-scene-text="">
          <p className={styles.widgetPlace}>{weather.place.split(',')[0]}</p>
          <p className={styles.widgetTemp}>{tx.temp(weather.forecast.temp)}</p>
          <p className={styles.widgetWord}>
            <span>{[word, stale].filter(Boolean).join(' · ')}</span>
            {rain ? <span className={styles.widgetRain}>{rain}</span> : null}
          </p>
        </div>
      </div>
    );

  return (
    <div className={styles.widget} data-testid="weather-widget" data-variant="porthole">
      {scene ? (
        <span className={styles.widgetSky}>
          <ScenePorthole state={scene} size={64} />
        </span>
      ) : null}
      <KpiWidget
        loading={!settings || (!weather && !noPlace)}
        value={weather ? tx.temp(weather.forecast.temp) : undefined}
        label={weather?.place.split(',')[0]}
        context={weather ? [word, rain, stale].filter(Boolean).join(' · ') : undefined}
        empty={tp.widgetEmpty}
        emptyAction={{ label: tp.widgetAction, to: '/weather' }}
      />
    </div>
  );
}
