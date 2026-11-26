#!/usr/bin/env node
/**
 * Records the weather fixtures from real Open-Meteo answers (round 2, package B, step 1): one forecast request with
 * every variable the app asks for and one air-quality request, both for Bern at the app's ~1 km rounding. Run it on a
 * machine that reaches the hosts: `node scripts/capture-weather-fixtures.mjs`. It overwrites
 * `src/core/weather/fixtures/forecast-bern-r2.json` and `air-bern-r2.json`; the tests then run against the recorded
 * answer. It sends nothing but the rounded position of a public place.
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../src/core/weather/fixtures');
const position = { latitude: '46.95', longitude: '7.45' };

const forecast = new URLSearchParams({
  ...position,
  current:
    'temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,is_day,cloud_cover,pressure_msl,wind_direction_10m,snow_depth',
  hourly:
    'temperature_2m,weather_code,precipitation_probability,apparent_temperature,precipitation,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,uv_index,is_day,cloud_cover,pressure_msl,wind_direction_10m,snowfall,snow_depth,visibility,cloud_cover_low,cloud_cover_mid,cloud_cover_high,sunshine_duration,dew_point_2m,cape,freezing_level_height',
  minutely_15: 'precipitation',
  forecast_minutely_15: '8',
  daily:
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,apparent_temperature_max,apparent_temperature_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset,sunshine_duration,precipitation_hours,wind_direction_10m_dominant',
  timezone: 'auto',
  forecast_days: '7',
});
const air = new URLSearchParams({
  ...position,
  current: 'european_aqi',
  hourly: 'european_aqi',
  timezone: 'auto',
  forecast_days: '5',
});

async function save(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const body = await res.json();
  writeFileSync(resolve(out, file), `${JSON.stringify(body, null, 2)}\n`);
  console.log(`${file}: written`);
}

await save(`https://api.open-meteo.com/v1/forecast?${forecast}`, 'forecast-bern-r2.json');
await save(`https://air-quality-api.open-meteo.com/v1/air-quality?${air}`, 'air-bern-r2.json');
