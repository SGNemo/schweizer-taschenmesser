import type { PageLayout } from './types';

/**
 * The width variant a module page really gets (identity v3, `docs/design/identity-v3/02-CONCEPT.md` § 1). One frame width
 * per area: a module that asks for `content` (or says nothing) takes the area's `wide`, so switching modules inside an area
 * never makes the head, the sub-navigation and the page jump between a 70 rem island and a wide page. `narrow` (a single
 * column on purpose), `full` (grids that need the whole screen) and the two layouts of Identity 4.0, `reading` and `split`
 * (a declared choice of the module's area package), stay as declared.
 */
export function frameVariant(layout: PageLayout | undefined): PageLayout {
  return layout === undefined || layout === 'content' ? 'wide' : layout;
}
