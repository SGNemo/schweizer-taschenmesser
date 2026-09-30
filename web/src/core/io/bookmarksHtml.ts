/**
 * Browser bookmark exports (the "Netscape bookmark file" every major browser writes): links with the
 * folder names above them as tags. Only http(s) links are kept.
 */
export interface HtmlBookmark {
  title: string;
  url: string;
  tags: string[];
}

const MAX_TAGS = 3;

export function parseBookmarksHtml(html: string): HtmlBookmark[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: HtmlBookmark[] = [];
  const seen = new Set<string>();

  // <DL> lists nest; a folder is `<DT><H3>name</H3><DL>…</DL>`. The parser may place the <DL> as a
  // child of the <DT> or as its next sibling, so folders are resolved from the anchor upwards.
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href')?.trim() ?? '';
    if (!/^https?:\/\//i.test(href)) continue;
    let url: string;
    try {
      url = new URL(href).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    const tags: string[] = [];
    for (let dl = a.closest('dl'); dl; dl = dl.parentElement?.closest('dl') ?? null) {
      const heading = folderName(dl);
      if (heading) tags.unshift(heading);
    }
    out.push({
      title: (a.textContent ?? '').trim() || url,
      url,
      tags: tags.slice(-MAX_TAGS),
    });
  }
  return out;
}

function folderName(dl: Element): string | undefined {
  // <h3> directly before the <dl> (sibling) or in the enclosing <dt>.
  const prev = dl.previousElementSibling;
  const own = prev?.tagName === 'H3' ? prev : prev?.querySelector(':scope > h3');
  const inDt =
    dl.parentElement?.tagName === 'DT' ? dl.parentElement.querySelector(':scope > h3') : null;
  const name = (own ?? inDt)?.textContent?.trim();
  // The browser's root folders carry no information.
  if (
    !name ||
    /^(Lesezeichen(-Symbolleiste| ?leiste)?|Bookmarks( bar| toolbar| menu)?|Andere Lesezeichen|Other bookmarks)$/i.test(
      name,
    )
  )
    return undefined;
  return name.toLowerCase();
}
