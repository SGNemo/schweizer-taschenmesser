import { formatNumber } from '@/core/i18n/format';

/** Local date at an hour from a place-local ISO string (the forecast times carry no zone). */
export const localDate = (iso: string, hour = 0): Date =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), hour);

export const dec = (n: number): string => formatNumber(n, { maximumFractionDigits: 1 });

/** A piece of a row's detail line; `kind` only picks a meaningful colour (rain blue, strong UV / pollen amber). */
export interface Part {
  t: string;
  k?: 'rain' | 'uv' | 'pollen';
}
export const txt = (t: string, k?: Part['k']): Part => ({ t, k });

/** Temperature as a tone for colour, always printed next to the number. */
export const tone = (t: number): 'cold' | 'mild' | 'warm' | 'hot' =>
  t <= 5 ? 'cold' : t < 18 ? 'mild' : t < 28 ? 'warm' : 'hot';

export function Meta({ parts, className }: { parts: Part[]; className?: string }) {
  return (
    <p className={className}>
      {parts.map((p, i) => (
        <span key={p.t}>
          {i > 0 ? ' · ' : ''}
          <span data-kind={p.k}>{p.t}</span>
        </span>
      ))}
    </p>
  );
}
