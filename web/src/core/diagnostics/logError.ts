import { recordError } from './errorLog';

/**
 * Handler for a promise that may fail without the user needing to know: `.catch(logError('resume'))`
 * instead of `.catch(() => undefined)`. The failure still does not interrupt anything, but it lands
 * in the (scrubbed, local, user-exported-only) diagnostics log, so a bug report can show it.
 * Never use it for failures that are expected (a denied clipboard, a refused autoplay): those would
 * only add noise.
 */
export const logError =
  (tag: string) =>
  (error: unknown): undefined => {
    recordError(tag, error);
    return undefined;
  };
