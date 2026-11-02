import type { Maturity, WidgetDef } from '@/core/modules/types';

/**
 * Maturity of one home widget: it inherits the module's and a widget can tighten it to `preview`
 * (`WidgetDef.maturity`). A preview *module* never reaches the home screen unless the user switched
 * it on (library with "In Arbeit anzeigen"), so for the grid only the widget's own tightening hides
 * anything; the inherited value drives the "In Arbeit" badge.
 */
export const widgetMaturity = (
  moduleMaturity: Maturity,
  widget: Pick<WidgetDef, 'maturity'>,
): Maturity => (widget.maturity === 'preview' ? 'preview' : moduleMaturity);

export interface WidgetMaturityContext {
  /** "In Arbeit anzeigen" (`stores/ui.ts`). */
  showPreview: boolean;
  /** Widget keys the user pinned (`HomeLayout.pinned`): a pinned preview widget stays. */
  pinned: readonly string[];
}

/**
 * The maturity rule for home widgets: a widget marked `preview` is listed (grid, edit mode, widget
 * sheet) only while "In Arbeit anzeigen" is on or the user pinned it. Nothing in the stored layout
 * changes: hidden keys, sizes and the order stay as they are.
 */
export function isWidgetVisible(
  key: string,
  widget: Pick<WidgetDef, 'maturity'>,
  ctx: WidgetMaturityContext,
): boolean {
  return widget.maturity !== 'preview' || ctx.showPreview || ctx.pinned.includes(key);
}
