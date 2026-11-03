/**
 * Link preview: title, description and a small picture of the page a saved link points to. Only runs
 * when the setting is on; the page is fetched without cookies or login through `fetchPublic`, parsed
 * in an inert document (`parsePageMeta`) and reduced to plain data. The picture is a raster image of
 * at most 512 KB kept on this device only (`_blobs`, never synced or exported).
 */
import { useEffect, useState } from 'react';
import { deleteBlob, getBlob, putBlob } from '@/core/blobs';
import { parsePageMeta } from '@/core/io/pageMeta';
import { fetchPublic } from '@/core/net/fetchPublic';
import { getSettings } from '@/core/settings/settings';
import { itemRepo } from './repo';
import { settings as moduleSettings, settingsSchema } from './settings';

export const previewKey = (id: string): string => `bookmarks:preview:${id}`;

/** Is the preview switched on? (Off by default; a failure to read counts as off.) */
export async function previewEnabled(): Promise<boolean> {
  try {
    const s = await getSettings(
      'module.bookmarks',
      settingsSchema,
      moduleSettings.defaults as never,
    );
    return s.linkPreview;
  } catch {
    return false;
  }
}

/** Fetches and stores the preview of one item; every failure ends quietly (the row just has no preview). */
export async function fetchPreviewFor(id: string, url: string): Promise<void> {
  try {
    const res = await fetchPublic(url, undefined, undefined, 'page');
    if (!res.ok) return;
    const meta = parsePageMeta(await res.text(), url);
    let image = false;
    if (meta.imageUrl) {
      try {
        const img = await fetchPublic(meta.imageUrl, undefined, undefined, 'image');
        if (img.ok) {
          await putBlob(previewKey(id), await img.blob());
          image = true;
        }
      } catch {
        /* no picture is fine */
      }
    }
    if (!meta.title && !meta.description && !meta.siteName && !image) return;
    await itemRepo.update(id, {
      preview: { site: meta.siteName, description: meta.description, image: image || undefined },
    });
  } catch {
    /* offline, blocked, not a page: no preview */
  }
}

export const removePreviewImage = (id: string): Promise<void> => deleteBlob(previewKey(id));

/** An object URL for the stored picture of an item (released when the row goes away). */
export function usePreviewImage(id: string, has: boolean | undefined): string | undefined {
  const [loaded, setLoaded] = useState<{ id: string; src: string } | null>(null);
  useEffect(() => {
    if (!has) return;
    let url: string | undefined;
    let alive = true;
    void getBlob(previewKey(id)).then((blob) => {
      if (!alive || !blob) return;
      url = URL.createObjectURL(blob);
      setLoaded({ id, src: url });
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, has]);
  return has && loaded?.id === id ? loaded.src : undefined;
}
