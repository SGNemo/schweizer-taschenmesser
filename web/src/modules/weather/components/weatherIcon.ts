import type { CodeGroup } from '@/core/weather/logic';
import type { IconName } from '@/ui';

/** The icon of a weather word; at night a clear sky is the moon. */
export function weatherIcon(group: CodeGroup, night = false): IconName {
  switch (group) {
    case 'clear':
      return night ? 'moon' : 'sun';
    case 'partly':
      return night ? 'cloudMoon' : 'cloudSun';
    case 'cloudy':
      return 'cloud';
    case 'fog':
      return 'cloudFog';
    case 'drizzle':
      return 'cloudDrizzle';
    case 'rain':
    case 'showers':
      return 'cloudRain';
    case 'snow':
      return 'cloudSnow';
    case 'thunder':
      return 'cloudLightning';
  }
}
