import { Icon } from '../icons';
import { Sparkline } from './Sparkline';
import { useWidgetSize } from './size';
import styles from './Widgets.module.css';

export interface KennzahlTrend {
  /** Direction arrow; `tone` only colours it when the change is bad ("danger") – never plain red/green. */
  direction: 'up' | 'down' | 'flat';
  /** Text next to the arrow, e.g. "+120 € zum Vormonat". */
  text: string;
  tone?: 'neutral' | 'danger';
}

/**
 * The `kennzahl` widget shape (identity v3.1, F05): one figure with unit, always a context line (a number without
 * context says little), at size m the trend, at size l the sparkline. Pure shape: loading and empty states come
 * from `WidgetBody` around it; `KpiWidget` is that pair. The finance "Kontostand" widget is the first example.
 * Reading load: leave `label` out when it would repeat the widget's title, and never let `context` restate the
 * figure ("6 Feeds" under "6") – say what the figure means instead.
 */
export function KennzahlBody({
  value,
  unit,
  label,
  context,
  trend,
  series,
  seriesLabel,
}: {
  /** Formatted figure. */
  value: string;
  unit?: string;
  /** Small caption above the figure ("Kontostand"). */
  label?: string;
  /** The context line under the figure ("2 Konten · verfügbar 1.204 €"): required, a number without context says little. */
  context: string;
  trend?: KennzahlTrend;
  series?: readonly number[];
  seriesLabel?: string;
}) {
  const size = useWidgetSize();
  return (
    <div className={styles.kpi} data-body="kennzahl">
      {label ? <p className={styles.kpiLabel}>{label}</p> : null}
      <p className={styles.kpiValue}>
        {value}
        {unit ? <span className={styles.kpiUnit}> {unit}</span> : null}
      </p>
      {context ? <p className={styles.sub}>{context}</p> : null}
      {size !== 's' && trend ? (
        <p className={styles.trend} data-tone={trend.tone ?? 'neutral'}>
          <Icon
            name={
              trend.direction === 'up'
                ? 'trendUp'
                : trend.direction === 'down'
                  ? 'trendDown'
                  : 'arrowRight'
            }
            size={16}
          />
          {trend.text}
        </p>
      ) : null}
      {size === 'l' && series && series.length > 1 ? (
        <Sparkline values={series} label={seriesLabel} width={240} height={48} />
      ) : null}
    </div>
  );
}
