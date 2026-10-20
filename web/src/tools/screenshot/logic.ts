/** Pure parts of the screenshot tool: support check, file name, what a failed capture means. */
import { pad2 } from '@/core/time/dates';

export interface DisplayCaptureNavigator {
  mediaDevices?: { getDisplayMedia?: unknown };
}

/** Screen capture exists in desktop browsers and the desktop app; phones and some webviews lack it. */
export function canCaptureScreen(nav: DisplayCaptureNavigator = navigator): boolean {
  return typeof nav.mediaDevices?.getDisplayMedia === 'function';
}

/** `bildschirmfoto-2026-10-19-1430.png`, local time. */
export function screenshotFileName(date: Date): string {
  const day = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  return `bildschirmfoto-${day}-${pad2(date.getHours())}${pad2(date.getMinutes())}.png`;
}

export type CaptureFailure = 'cancelled' | 'unsupported' | 'failed';

/** A refused or dismissed picker is not an error: nothing was taken, nothing is wrong. A webview that refuses capture is "not available here". */
export function classifyCaptureError(e: unknown): CaptureFailure {
  const name = (e as { name?: string } | undefined)?.name;
  if (name === 'NotSupportedError') return 'unsupported';
  return name === 'NotAllowedError' || name === 'AbortError' ? 'cancelled' : 'failed';
}

/** The optional pause between choosing a source and the picture, to switch to the window. */
export const CAPTURE_DELAY_SECONDS = 3;
