import type { Strings } from '@/strings';

export const charts: Strings['charts'] = {
  empty: 'No values yet.',
  other: 'Other',
  total: 'Total',
  item: 'Item',
  value: 'Value',
  share: 'Share',
  target: 'Planned',
  ofTarget: (target) => `of ${target}`,
  over: (amount) => `${amount} over`,
  overPlain: 'more than planned',
  overKey: 'over',
  latest: (label, value) => `${label} ${value}`,
  donutSummary: (n, top, share, total) =>
    [
      n === 1 ? `One share: ${top}` : `${n} shares, largest ${top} at ${share}`,
      total ? `Total ${total}` : null,
    ]
      .filter(Boolean)
      .join('. ') + '.',
  barsSummary: (n, over) =>
    `${n === 1 ? 'One value' : `${n} values`}${over > 0 ? `, ${over} of them more than planned` : ''}.`,
  trendSummary: (label, n, first, last) =>
    n === 1
      ? `${label}: one value${last ? `, ${last}` : ''}.`
      : `${label}: ${n} values${first && last ? `, from ${first} to ${last}` : ''}.`,
};
