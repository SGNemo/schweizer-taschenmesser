/**
 * What a web page says about itself, as plain data: title, description, site name and a preview
 * image address. Used by the link preview of the bookmarks and the tab cards of the browser; the page
 * is parsed in an inert document (nothing runs, nothing loads) and every text is reduced to plain text.
 */
import { plainText, safeHttpUrl } from './feed';

export interface PageMeta {
  title?: string;
  description?: string;
  siteName?: string;
  /** Absolute `https://` address of the preview picture; fetched separately, never embedded. */
  imageUrl?: string;
}

const TITLE_LENGTH = 200;
const DESCRIPTION_LENGTH = 300;

function metaContent(doc: Document, keys: string[]): string | undefined {
  for (const key of keys) {
    for (const el of Array.from(doc.querySelectorAll('meta'))) {
      const name = (el.getAttribute('property') ?? el.getAttribute('name') ?? '').toLowerCase();
      if (name !== key) continue;
      const content = el.getAttribute('content')?.trim();
      if (content) return content;
    }
  }
  return undefined;
}

export function parsePageMeta(html: string, pageUrl: string): PageMeta {
  const doc = new DOMParser().parseFromString(html.slice(0, 1024 * 1024), 'text/html');
  const text = (value: string | undefined, limit: number): string | undefined => {
    const out = value ? plainText(value, limit) : '';
    return out || undefined;
  };
  const title = text(
    metaContent(doc, ['og:title', 'twitter:title']) ?? doc.querySelector('title')?.textContent,
    TITLE_LENGTH,
  );
  const description = text(
    metaContent(doc, ['og:description', 'twitter:description', 'description']),
    DESCRIPTION_LENGTH,
  );
  const siteName = text(metaContent(doc, ['og:site_name']), 80);
  const image = safeHttpUrl(
    metaContent(doc, ['og:image:secure_url', 'og:image', 'twitter:image']),
    pageUrl,
  );
  const imageUrl = image?.startsWith('https://') ? image : undefined;
  return { title, description, siteName, imageUrl };
}
