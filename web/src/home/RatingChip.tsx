import type { Rating } from '@/core/weather/logic';
import { tWeather } from '@/strings.weather';
import { Icon, type IconName } from '@/ui';
import styles from './WeatherPreview.module.css';

// "Ungemütlich" gets the umbrella, not the warning triangle: that one is reserved for overdue things
// (`ui/semantics.ts`), and neither weather nor air quality is ever urgent.
const RATING_ICON: Record<Rating, IconName> = { good: 'ok', fair: 'circleMinus', poor: 'umbrella' };

/** Rating as word + icon + colour: the colour is never alone. */
export function RatingChip({ rating }: { rating: Rating }) {
  const tx = tWeather.use();
  return (
    <span className={styles.chip} data-rating={rating}>
      <Icon name={RATING_ICON[rating]} size={14} />
      {tx.ratings[rating]}
    </span>
  );
}
