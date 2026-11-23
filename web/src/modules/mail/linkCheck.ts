/**
 * What a click on a mail link does (M6, launch review 2026-11). The mail is the sender's page: its
 * link text can name one site while the link goes to another (the classic phishing shape). Such a
 * link is asked about first, naming the real host; any other http(s), `mailto:` or `tel:` link opens
 * as before; nothing else opens at all.
 */
export type LinkDecision = { open: string } | { ask: string; host: string } | { none: true };

const SAFE_OPEN = /^(https?:|mailto:|tel:)/i;
/** Domains written in the link text (`www.bank.example`, `https://bank.example/x`). */
const DOMAIN_IN_TEXT = /(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})/gi;
/** File names look like domains (`Rechnung.pdf`); a text naming one is not naming a site. */
const FILE_ENDING =
  /\.(pdf|docx?|xlsx?|pptx?|odt|ods|txt|csv|zip|rar|7z|jpe?g|png|gif|webp|heic|svg|mp3|mp4|mov|ics|vcf|eml|xml|json|html?)$/i;

const bare = (host: string) => host.toLowerCase().replace(/^www\./, '');
const sameSite = (a: string, b: string) => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);

export function linkDecision(text: string, href: string): LinkDecision {
  if (!SAFE_OPEN.test(href)) return { none: true };
  if (!/^https?:/i.test(href)) return { open: href };
  let host: string;
  try {
    host = new URL(href).hostname.toLowerCase();
  } catch {
    return { none: true };
  }
  const real = bare(host);
  // every domain the text names counts: hidden text can put the real one first (F2, council)
  for (const m of text.slice(0, 500).matchAll(DOMAIN_IN_TEXT)) {
    const named = m[1]!;
    if (!m[0].includes('://') && FILE_ENDING.test(named)) continue;
    if (!sameSite(real, bare(named))) return { ask: href, host };
  }
  return { open: href };
}
