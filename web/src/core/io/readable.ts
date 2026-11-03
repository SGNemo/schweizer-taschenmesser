/**
 * Reader text of a web page: the main content as a short list of typed text blocks. The result is
 * plain data (no markup, no links, no images): callers render it as text, so nothing from the page can
 * run or load. Parsing happens in an inert document. Pages that are not article-like give an empty list.
 */
import { plainText } from './feed';

export type ReadableBlock =
  { type: 'h'; level: 2 | 3; text: string } | { type: 'p' | 'li' | 'quote'; text: string };

export interface Readable {
  title: string;
  blocks: ReadableBlock[];
}

export const MAX_BLOCKS = 400;
const MAX_BLOCK_TEXT = 2000;
/** Below this much text a page is a menu or an app, not something to read. */
const MIN_TOTAL = 200;

const NOISE =
  'script, style, noscript, template, iframe, object, embed, svg, canvas, form, button, select, input, textarea, nav, header, footer, aside, dialog, [hidden], [aria-hidden="true"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]';

const textLength = (el: Element): number => el.textContent.replace(/\s+/g, ' ').trim().length;

function linkDensity(el: Element): number {
  const total = textLength(el);
  if (total === 0) return 1;
  let linked = 0;
  el.querySelectorAll('a').forEach((a) => (linked += textLength(a)));
  return linked / total;
}

/** The element whose direct paragraphs carry the most text (article/main win ties by being listed first). */
function pickContainer(doc: Document): Element {
  const candidates = [
    ...Array.from(doc.querySelectorAll('article, main, [role="main"]')),
    ...Array.from(doc.querySelectorAll('section, div')),
    doc.body,
  ];
  let best: Element = doc.body;
  let bestScore = -1;
  for (const el of candidates) {
    let score = 0;
    for (const child of Array.from(el.children))
      if (child.localName === 'p' && linkDensity(child) < 0.5) score += textLength(child);
    if (['article', 'main'].includes(el.localName)) score += 50;
    if (score > bestScore) {
      best = el;
      bestScore = score;
    }
  }
  return best;
}

export function parseReadable(html: string): Readable {
  const doc = new DOMParser().parseFromString(html.slice(0, 1024 * 1024), 'text/html');
  const pageTitle = doc.querySelector('title')?.textContent;
  doc.querySelectorAll(NOISE).forEach((e) => e.remove());
  // after the noise is gone, so the site header's <h1> is not mistaken for the article's
  const title = plainText(doc.querySelector('h1')?.textContent ?? pageTitle ?? '', 200);
  const root = pickContainer(doc);
  const blocks: ReadableBlock[] = [];
  let total = 0;
  for (const el of Array.from(root.querySelectorAll('h1, h2, h3, h4, p, li, blockquote'))) {
    if (blocks.length >= MAX_BLOCKS) break;
    const name = el.localName;
    // a list item or quote that only holds a paragraph is read once, through the paragraph
    if ((name === 'blockquote' || name === 'li') && el.querySelector('p')) continue;
    const text = plainText(el.innerHTML, MAX_BLOCK_TEXT);
    if (!text || (name === 'li' && linkDensity(el) > 0.6)) continue;
    if (name === 'p' && el.closest('li, blockquote')) continue;
    if (name === 'h1' || name === 'h2') {
      if (text === title && blocks.length === 0) continue; // the page title is shown above
      blocks.push({ type: 'h', level: 2, text });
    } else if (name === 'h3' || name === 'h4') blocks.push({ type: 'h', level: 3, text });
    else if (name === 'blockquote') blocks.push({ type: 'quote', text });
    else if (name === 'li') blocks.push({ type: 'li', text });
    else {
      if (linkDensity(el) > 0.7 && text.length < 80) continue; // "Read more" lines and link rows
      blocks.push({ type: 'p', text });
    }
    total += text.length;
  }
  return total < MIN_TOTAL ? { title, blocks: [] } : { title, blocks };
}
