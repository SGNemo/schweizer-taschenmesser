import type { IconName } from './icons';

/**
 * Colour semantics of the app (docs/design/DESIGN-SPEC.md §4b). Colour carries one of these meanings and is
 * always paired with an icon or a text label; everything else (titles, body, icons) stays neutral.
 * `color` is a token; `label` is the text that accompanies it when the surrounding UI has no wording of its own.
 */
export type Meaning =
  | 'overdue'
  | 'today'
  | 'soon'
  | 'done'
  | 'inactive'
  | 'income'
  | 'expense'
  | 'connected'
  | 'locked';

export interface MeaningSpec {
  color: string;
  icon?: IconName;
  /** German label (key of `t.meanings`). */
  label: Meaning;
  /** Does the meaning survive the "Ruhig" colour mode? Only overdue and today keep their colour. */
  calm: boolean;
}

export const MEANINGS: Record<Meaning, MeaningSpec> = {
  overdue: { color: 'var(--danger)', icon: 'alert', label: 'overdue', calm: true },
  today: { color: 'var(--accent)', icon: 'clock', label: 'today', calm: true },
  soon: { color: 'var(--text-muted)', label: 'soon', calm: false },
  done: { color: 'var(--text-3)', icon: 'check', label: 'done', calm: false },
  inactive: { color: 'var(--text-3)', label: 'inactive', calm: false },
  income: { color: 'var(--success)', label: 'income', calm: false },
  expense: { color: 'var(--danger)', label: 'expense', calm: false },
  connected: { color: 'var(--success)', icon: 'check', label: 'connected', calm: false },
  locked: { color: 'var(--warning)', icon: 'lock', label: 'locked', calm: false },
};

/** Fixed category palette (`--cat-1…6`, tokens.css); a module assigns a category an index, the chip shows the name too. */
export const CATEGORY_COUNT = 6;
export const categoryColor = (index: number): string =>
  `var(--cat-${((Math.abs(Math.trunc(index)) % CATEGORY_COUNT) + 1).toString()})`;

/** Stable colour index for a category name (same name → same colour on every device). */
export function categoryIndex(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % CATEGORY_COUNT;
}
