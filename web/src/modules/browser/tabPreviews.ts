/**
 * Preview pictures for the tab overview. Only when the setting is on: for each open, non-private tab the
 * page is fetched once more without cookies or login (`fetchPublic`, kind page/image), reduced to its
 * `og:image` and kept as an object URL for this session only. Nothing is stored and nothing reaches the tab.
 */
import { useEffect, useState } from 'react';
import { parsePageMeta } from '@/core/io/pageMeta';
import { fetchPublic } from '@/core/net/fetchPublic';
import type { Tab } from './tabsStore';

const eligible = (tab: Tab): boolean =>
  tab.opened && !tab.isPrivate && tab.url.startsWith('https://');

export function useTabPreviews(tabs: Tab[], enabled: boolean): Record<string, string> {
  const [images, setImages] = useState<Record<string, string>>({});
  const urls = enabled ? [...new Set(tabs.filter(eligible).map((x) => x.url))] : [];
  const wanted = urls.filter((u) => !(u in images)).join('\n');

  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    for (const url of wanted.split('\n')) {
      void (async () => {
        try {
          const page = await fetchPublic(url, undefined, undefined, 'page');
          if (!page.ok) return;
          const { imageUrl } = parsePageMeta(await page.text(), url);
          if (!imageUrl) return;
          const img = await fetchPublic(imageUrl, undefined, undefined, 'image');
          if (!img.ok) return;
          const objectUrl = URL.createObjectURL(await img.blob());
          if (alive) setImages((old) => ({ ...old, [url]: objectUrl }));
          else URL.revokeObjectURL(objectUrl);
        } catch {
          /* no picture: the card shows its monogram */
        }
      })();
    }
    return () => {
      alive = false;
    };
  }, [wanted]);

  // the pictures live as long as the page does
  useEffect(
    () => () => {
      for (const u of Object.values(images)) URL.revokeObjectURL(u);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return enabled ? images : {};
}
