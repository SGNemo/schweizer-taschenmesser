/**
 * Link preview: title, description and a small picture of the page a saved link points to. Only runs
 * when the setting is on; the page is fetched without cookies or login through `fetchPublic`, parsed
 * in an inert document (`parsePageMeta`) and reduced to plain data. The picture is a raster image of
 * at most 512 KB kept on this device only (`_blobs`, never synced or exported).
 */
import { useEffect, useState } from 'react';
import { deleteBlob, getBlob, putBlob } from '@/core/blobs';
import { parsePageMeta } from '@/core/io/pageMeta';
import { fetchPublic, PublicFetchError } from '@/core/net/fetchPublic';
import { getPlatform } from '@/core/platform';
import { syncConfigKind } from '@/core/sync/service';
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

/** `unavailable`: this device cannot ask the page (the browser app has no way out without the sync server). */
export type PreviewResult = 'ok' | 'none' | 'unavailable';

/** Can this device fetch a page at all? The desktop and Android app ask it themselves; the browser app needs the sync server. */
export async function previewAvailable(): Promise<boolean> {
  if (getPlatform().isNative) return true;
  try {
    return (await syncConfigKind()) === 'selfHosted';
  } catch {
    return false;
  }
}

/**
 * Fetches and stores the preview of one item; every failure ends quietly (the row just has no preview).
 * `ok` = something was stored.
 */
export async function fetchPreviewNow(id: string, url: string): Promise<PreviewResult> {
  try {
    const res = await fetchPublic(url, undefined, undefined, 'page');
    if (!res.ok) return 'none';
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
    if (!meta.title && !meta.description && !meta.siteName && !image) return 'none';
    await itemRepo.update(id, {
      preview: { site: meta.siteName, description: meta.description, image: image || undefined },
    });
    return 'ok';
  } catch (e) {
    /* offline, blocked, not a page: no preview */
    return e instanceof PublicFetchError && e.code === 'no-proxy' ? 'unavailable' : 'none';
  }
}

/** The same without an answer, for the callers that fetch in passing (saving with the setting on). */
export async function fetchPreviewFor(id: string, url: string): Promise<void> {
  await fetchPreviewNow(id, url);
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
