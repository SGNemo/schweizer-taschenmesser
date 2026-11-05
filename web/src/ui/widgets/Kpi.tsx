import { KennzahlBody, type KennzahlTrend } from './KennzahlBody';
import { WidgetBody, type WidgetEmpty } from './WidgetBody';

export type KpiTrend = KennzahlTrend;

/**
 * KPI widget: `WidgetBody` (loading, empty state) around the `kennzahl` shape (`KennzahlBody`): one big number with
 * unit, a context line ("897,89 € · 2 überfällig"), an optional trend and (size l) a sparkline.
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
  /** Required: every figure carries its context line. */
  context: string;
  trend?: KpiTrend;
  series?: readonly number[];
  seriesLabel?: string;
}) {
  return (
    <WidgetBody loading={loading} isEmpty={value === undefined} {...emptyProps}>
      {value !== undefined ? (
        <KennzahlBody
          value={value}
          unit={unit}
          label={label}
          context={context}
          trend={trend}
          series={series}
          seriesLabel={seriesLabel}
        />
      ) : null}
    </WidgetBody>
  );
}
