import { useEffect, useState } from 'react';
import type { ConnectorContext } from '@/core/connectors/types';
import { COVER_URL } from '@/connectors/spotify/api';

/**
 * The cover as a local `blob:` URL: fetched through the platform (so the connection log sees it and
 * "Netzwerk sperren" applies, and the app's image policy stays as strict as it is), from Spotify's image
 * host only, once per picture. No cover on any failure; the widget then shows an icon.
 */
export function useCover(
  ctx: ConnectorContext | undefined,
  url: string | undefined,
): string | undefined {
  const [cover, setCover] = useState<{ url: string; blob: string }>();
  useEffect(() => {
    if (!ctx || !url || !COVER_URL.test(url) || typeof URL.createObjectURL !== 'function') return;
    let alive = true;
    let made: string | undefined;
    void (async () => {
      try {
        const res = await ctx.fetch(url);
        if (!res.ok) return;
        const blob = await res.blob();
        if (!blob.type.startsWith('image/')) return;
        made = URL.createObjectURL(blob);
        if (alive) setCover({ url, blob: made });
        else URL.revokeObjectURL(made);
      } catch {
        // No cover: the icon stays.
      }
    })();
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [ctx, url]);
  return cover && cover.url === url ? cover.blob : undefined;
}
