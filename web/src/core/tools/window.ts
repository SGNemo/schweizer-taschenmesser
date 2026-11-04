import { getPlatform } from '@/core/platform';

/** Where a tool detached from the panel lives (`router.tsx` route `tool/:id`). */
export const TOOL_WINDOW_PREFIX = '/tool/';
export const toolWindowPath = (id: string): string => `${TOOL_WINDOW_PREFIX}${id}`;

/**
 * True while this page is a tool alone in its own browser window: no shell, no background services,
 * no handoffs to Notes or the vault. Only the browser detaches tools; the apps redirect to the panel.
 */
export const isToolWindow = (): boolean =>
  window.location.pathname.startsWith(TOOL_WINDOW_PREFIX) && getPlatform().kind === 'web';
