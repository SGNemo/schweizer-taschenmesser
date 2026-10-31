import { getPlatform } from '@/core/platform';

/**
 * OpenStreetMap's services ask every client to identify itself. A browser sets its own User-Agent (and a
 * custom header would only cause a cross-origin preflight), the native shell sends none: only there we add it.
 */
export function identify(): { headers?: Record<string, string> } {
  return getPlatform().isNative
    ? { headers: { 'User-Agent': 'Nemo (https://github.com/SGNemo/schweizer-taschenmesser)' } }
    : {};
}
