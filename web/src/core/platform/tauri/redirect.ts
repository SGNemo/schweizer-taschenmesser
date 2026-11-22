/**
 * The desktop's own fetch (Tauri http plugin) does not know the standard `redirect` option; its own word
 * for "follow nothing" is `maxRedirections: 0` (it then hands back the 3xx answer with its `Location`).
 * A caller that asks for `redirect: 'manual'` wants exactly that, so the option is translated here and
 * no code outside the platform has to know the plugin's field.
 */
export function nativeInit(init?: RequestInit): RequestInit | undefined {
  if (init?.redirect !== 'manual') return init;
  return { ...init, maxRedirections: 0 } as RequestInit;
}
