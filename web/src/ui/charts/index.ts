/**
 * Shared charts: import from `@/ui/charts` (not the `@/ui` barrel, so pages without a chart do not load them).
 * When to use which: docs/howto/charts.md.
 */
export { Donut, type DonutProps } from './Donut';
export { Bars, type BarDatum, type BarsProps } from './Bars';
export { Trend, type TrendProps, type TrendSeries } from './Trend';
export { Spark, type SparkProps } from './Spark';
export type { ChartBaseProps, ValueFormat } from './parts';
export {
  foldShares,
  formatShare,
  niceScale,
  MAX_SEGMENTS,
  type ChartDatum,
  type Share,
} from './model';
