/**
 * Makes untrusted mail HTML safe to show. DOMPurify does the heavy lifting; on top:
 *  - no `<style>`, forms, frames, SVG, scripts, event handlers, `srcset`, CSS `url()` / `@import`;
 *  - remote images are withheld unless the caller hands in their (already downloaded) data URLs;
 *  - tracking pixels (1×1 / hidden images) are always dropped;
 *  - `cid:` images resolve to inline parts passed in, otherwise disappear;
 *  - links keep only http(s)/mailto/tel and get `rel="noopener noreferrer nofollow"`.
 * The result is shown in a sandboxed `<iframe srcdoc>` without scripts (`MailFrame`); this file is the
 * second line of defence, the iframe CSP (`mailDocument`) the third.
 */
import DOMPurify from 'dompurify';

export interface SanitizeOptions {
  /** Remote image URL → data URL, for images the user chose to load (see `fetchRemoteImages`). */
  images?: Record<string, string>;
  /** Content-ID (without `cid:` and angle brackets) → data URL of an inline part. */
  cid?: Record<string, string>;
}

export interface SanitizeResult {
  html: string;
  /** Remote image URLs found (not tracking pixels), loaded or not. */
  remoteImages: string[];
  /** How many of them were withheld. */
  blocked: number;
  /** Tracking pixels that were removed. */
  trackers: number;
}

const FORBID_TAGS = [
  'style',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'option',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'link',
  'meta',
  'base',
  'svg',
  'math',
  'video',
  'audio',
  'source',
  'track',
  'canvas',
  'script',
  'noscript',
  'template',
  'dialog',
];
const FORBID_ATTR = [
  'srcset',
  'formaction',
  'action',
  'ping',
  'background',
  'poster',
  'autofocus',
  'contenteditable',
  'draggable',
  'id',
  'name',
];

const SAFE_LINK = /^(https?:|mailto:|tel:)/i;
const BAD_DECLARATION = /url\s*\(|expression\s*\(|@import|behavior\s*:|-moz-binding|javascript:/i;

/** Removes every CSS declaration that could load something or run code. */
export function cleanStyle(style: string): string {
  return style
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d !== '' && !BAD_DECLARATION.test(d))
    .join('; ');
}

const px = (value: string | null): number | undefined => {
  if (value === null) return undefined;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(px)?\s*$/i.exec(value);
  return m ? Number(m[1]) : undefined;
};

function isTrackingPixel(img: Element): boolean {
  const w = px(img.getAttribute('width'));
  const h = px(img.getAttribute('height'));
  if ((w !== undefined && w <= 2) || (h !== undefined && h <= 2)) return true;
  const style = (img.getAttribute('style') ?? '').toLowerCase().replace(/\s+/g, '');
  return (
    /(^|;)(width|height|max-width|max-height):[0-2](px)?(;|$)/.test(style) ||
    /display:none|visibility:hidden|opacity:0(;|$)/.test(style) ||
    img.hasAttribute('hidden')
  );
}

interface Run {
  options: SanitizeOptions;
  remote: Set<string>;
  blocked: number;
  trackers: number;
}
let run: Run | undefined;
let hooked = false;

function install(): void {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    const current = run;
    if (!current) return;
    const style = node.getAttribute('style');
    if (style !== null) {
      const cleaned = cleanStyle(style);
      if (cleaned) node.setAttribute('style', cleaned);
      else node.removeAttribute('style');
    }
    const tag = node.tagName;
    if (tag === 'A') {
      const href = node.getAttribute('href');
      if (href !== null && !SAFE_LINK.test(href.trim())) node.removeAttribute('href');
      node.removeAttribute('target');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
    if (tag === 'IMG') {
      const src = (node.getAttribute('src') ?? '').trim();
      if (isTrackingPixel(node)) {
        current.trackers += 1;
        node.remove();
      } else if (/^cid:/i.test(src)) {
        const data = current.options.cid?.[src.slice(4).replace(/^<|>$/g, '')];
        if (data) node.setAttribute('src', data);
        else node.remove();
      } else if (/^data:image\//i.test(src)) {
        // already inline
      } else if (/^https?:\/\//i.test(src)) {
        current.remote.add(src);
        const data = current.options.images?.[src];
        if (data) {
          node.setAttribute('src', data);
        } else {
          current.blocked += 1;
          node.removeAttribute('src');
          node.setAttribute('data-blocked', '1');
        }
      } else {
        node.remove();
      }
      node.removeAttribute('loading');
    }
  });
}

export function sanitizeMailHtml(html: string, options: SanitizeOptions = {}): SanitizeResult {
  install();
  run = { options, remote: new Set(), blocked: 0, trackers: 0 };
  try {
    const clean = DOMPurify.sanitize(html, {
      FORBID_TAGS,
      FORBID_ATTR,
      ALLOW_DATA_ATTR: false,
      ALLOW_ARIA_ATTR: false,
      USE_PROFILES: { html: true },
    });
    return {
      html: String(clean),
      remoteImages: [...run.remote],
      blocked: run.blocked,
      trackers: run.trackers,
    };
  } finally {
    run = undefined;
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain text → HTML: escaped, line breaks kept, http(s) addresses clickable. */
export function textToHtml(text: string): string {
  const safe = escapeHtml(text);
  const linked = safe.replace(
    /\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]]/g,
    (url) => `<a href="${url}" rel="noopener noreferrer nofollow">${url}</a>`,
  );
  return `<div style="white-space:pre-wrap;word-break:break-word">${linked}</div>`;
}

/** The colours of the "paper" the mail is shown on (an isolated document: no app tokens inside). */
const PAPER = { bg: '#ffffff', fg: '#1a1a1a', link: '#0b57d0', muted: '#5f6368' };

/**
 * The complete document for the iframe. Its CSP forbids everything but inline styles and `data:` images,
 * so even markup that slipped through could not load or run anything.
 */
export function mailDocument(bodyHtml: string): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<style>html,body{margin:0;padding:0;background:${PAPER.bg};color:${PAPER.fg}}` +
    'body{padding:12px;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;overflow-wrap:anywhere}' +
    `a{color:${PAPER.link}}img{max-width:100%;height:auto}table{max-width:100%}` +
    'blockquote{margin:8px 0 8px 4px;padding-left:10px;border-left:3px solid #c4c7c5}' +
    `img[data-blocked]{display:inline-block;min-width:24px;min-height:24px;outline:1px dashed ${PAPER.muted}}` +
    `</style></head><body>${bodyHtml}</body></html>`
  );
}

/**
 * Downloads the images the user allowed (through the platform `fetch`: native, no CORS) and returns them
 * as data URLs. Bounded: at most `max` images of at most `maxBytes` each; failures are skipped.
 */
export async function fetchRemoteImages(
  urls: readonly string[],
  fetchFn: typeof fetch,
  opts: { max?: number; maxBytes?: number; timeoutMs?: number } = {},
): Promise<Record<string, string>> {
  const { max = 20, maxBytes = 1_500_000, timeoutMs = 8000 } = opts;
  const out: Record<string, string> = {};
  for (const url of urls.slice(0, max)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, {
        signal: controller.signal,
        referrerPolicy: 'no-referrer',
        credentials: 'omit',
      });
      const mime = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
      if (!res.ok || !/^image\/(png|jpe?g|gif|webp|avif|bmp)$/.test(mime)) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length === 0 || bytes.length > maxBytes) continue;
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      out[url] = `data:${mime};base64,${btoa(binary)}`;
    } catch {
      // unreachable or too slow: the image simply stays withheld
    } finally {
      clearTimeout(timer);
    }
  }
  return out;
}
