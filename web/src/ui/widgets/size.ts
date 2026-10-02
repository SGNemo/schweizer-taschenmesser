import { createContext, useContext } from 'react';

export type WidgetSizeName = 's' | 'm' | 'l';

/** Size the home grid gave the widget; widgets take no props, so the type components read it here. */
export const WidgetSizeContext = createContext<WidgetSizeName>('m');

export const useWidgetSize = (): WidgetSizeName => useContext(WidgetSizeContext);

/** Rows to show per size, e.g. `rowsFor('m', [3, 5, 8])` → 5. */
export const rowsFor = (size: WidgetSizeName, rows: readonly [number, number, number]): number =>
  size === 's' ? rows[0] : size === 'm' ? rows[1] : rows[2];
