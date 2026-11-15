import { Spark } from '../charts/Spark';

/**
 * Tiny line chart of a few values for the widget bodies: the shared `Spark` (`@/ui/charts`) with the widget rule
 * that one value draws nothing (a dot says little beside a figure). `label` gives the text alternative.
 */
export function Sparkline({
  values,
  label,
  width = 96,
  height = 28,
}: {
  values: readonly number[];
  label?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  return <Spark values={values} label={label} width={width} height={height} />;
}
