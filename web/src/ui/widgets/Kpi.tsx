import { Icon } from '../icons';
import { Sparkline } from './Sparkline';
import { useWidgetSize } from './size';
import { WidgetBody, type WidgetEmpty } from './WidgetBody';
import styles from './Widgets.module.css';

export interface KpiTrend {
  /** Direction arrow; `tone` only colours it when the change is bad ("danger") – never plain red/green. */
  direction: 'up' | 'down' | 'flat';
  /** Text next to the arrow, e.g. "+120 € zum Vormonat". */
  text: string;
  tone?: 'neutral' | 'danger';
}

/**
 * KPI widget: one big number with unit, a context line ("897,89 € · 2 überfällig"), an optional
 * trend and (size l) a sparkline. The context line is always there (a number without context says
 * little); m adds the trend, l the sparkline.
 */
export function KpiWidget({
  loading,
  value,
  unit,
  label,
  context,
  trend,
  series,
  seriesLabel,
  ...emptyProps
}: WidgetEmpty & {
  loading: boolean;
  /** Formatted number; `undefined` renders the empty state. */
  value?: string;
  unit?: string;
  /** Small caption above the number ("Kontostand"). */
  label?: string;
  context?: string;
  trend?: KpiTrend;
  series?: readonly number[];
  seriesLabel?: string;
}) {
  const size = useWidgetSize();
  return (
    <WidgetBody loading={loading} isEmpty={value === undefined} {...emptyProps}>
      <div className={styles.kpi}>
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
    </WidgetBody>
  );
}
