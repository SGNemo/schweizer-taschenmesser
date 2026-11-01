/**
 * Tells when the colours of the page changed (theme attribute on the root, system dark mode), so the
 * drawn tiles of the own map are thrown away and drawn again from the new tokens.
 */
export function watchTheme(onChange: () => void): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const root = document.documentElement;
  const observer =
    typeof MutationObserver !== 'undefined' ? new MutationObserver(onChange) : undefined;
  observer?.observe(root, { attributes: true });
  const media =
    typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined;
  media?.addEventListener?.('change', onChange);
  return () => {
    observer?.disconnect();
    media?.removeEventListener?.('change', onChange);
  };
}
