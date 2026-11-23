/**
 * The desktop's own fetch (Tauri http plugin) does not know the standard `redirect` option; its own word
 * for "follow nothing" is `maxRedirections: 0` (it then hands back the 3xx answer with its `Location`).
 * A caller that asks for `redirect: 'manual'` wants exactly that, so the option is translated here and
 * no code outside the platform has to know the plugin's field.
 */
export function nativeInit(init?: RequestInit): RequestInit | undefined {
  if (init?.redirect !== 'manual' && init?.redirect !== 'error') return init;
  return { ...init, maxRedirections: 0 } as RequestInit;
}

/**
 * `redirect: 'error'` (M2, launch review 2026-11): the plugin hands the 3xx back (`maxRedirections: 0`);
 * like a browser, that is a network error for the caller, never a response it might read.
 */
export function checkRedirect(res: Response, init?: RequestInit): Response {
  if (init?.redirect === 'error' && res.status >= 300 && res.status < 400) {
    throw new TypeError('redirect refused');
  }
  return res;
}
